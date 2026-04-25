import { NextRequest } from 'next/server';
import { requireRole, apiHandler, json } from '@/lib/middleware';

function parseCSV(text: string): string[][] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  return lines.map(line => {
    const cols: string[] = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"' && !inQ) { inQ = true; }
      else if (ch === '"' && inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"' && inQ) { inQ = false; }
      else if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = ''; }
      else { cur += ch; }
    }
    cols.push(cur.trim());
    return cols;
  }).filter(r => r.some(c => c));
}

// Simple PDF text extraction (basic approach for structured text)
async function extractPDFText(buffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buffer);
  const decoder = new TextDecoder('utf-8');
  const str = decoder.decode(bytes);
  
  // Extract text from PDF content streams (simplified)
  const textMatches = str.match(/\[([^\]]+)\]\s*Tj|\(([^)]+)\)\s*Tj/g) || [];
  let text = '';
  for (const match of textMatches) {
    const content = match.replace(/[\[\]()]/g, '').replace(/\\(.)/g, '$1');
    text += content + ' ';
  }
  
  // Also try to extract from /BT...ET blocks
  const btMatches = str.match(/BT[\s\S]*?ET/g) || [];
  for (const block of btMatches) {
    const lines = block.match(/\(([^)]+)\)/g) || [];
    for (const line of lines) {
      text += line.replace(/[()]/g, '') + ' ';
    }
  }
  
  return text || decoder.decode(bytes);
}

// DOCX text extraction (XML-based)
async function extractDOCXText(buffer: ArrayBuffer): Promise<string> {
  const decoder = new TextDecoder('utf-8');
  const str = decoder.decode(buffer);
  
  // Look for w:t tags which contain text in Word documents
  const textMatches = str.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
  const text = textMatches.map(m => m.replace(/<[^>]+>/g, '')).join(' ');
  
  return text || decoder.decode(buffer);
}

// Parse questions from extracted text
function parseQuestionsFromText(text: string): { questions: any[]; errors: string[] } {
  const questions: any[] = [];
  const errors: string[] = [];
  
  const lines = text.split(/\n|\r/).map(l => l.trim()).filter(l => l);
  
  let currentQuestion: any = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineIndex = i + 1;
    
    // Detect question patterns
    const questionMatch = line.match(/^(?:\d+\.|Question\s*\d*[:.]?)\s*(.+)/i) ||
                         line.match(/^\d+\)\s*(.+)/) ||
                         line.match(/^Q\d*[:.]?\s*(.+)/i);
    
    if (questionMatch && !line.match(/^[a-dA-D][.)\s]/)) {
      // Save previous question if exists
      if (currentQuestion) {
        if (currentQuestion.question_type === 'MultipleChoice' && currentQuestion.options.length >= 2) {
          questions.push(currentQuestion);
        } else if (currentQuestion.question_type === 'Identification' && currentQuestion.answers.length > 0) {
          questions.push(currentQuestion);
        } else if (currentQuestion.question_type === 'Matching' && currentQuestion.options.length > 0) {
          questions.push(currentQuestion);
        } else {
          errors.push(`Question near line ${lineIndex}: Incomplete question data`);
        }
      }
      
      const qText = questionMatch[1].trim();
      currentQuestion = {
        question_text: qText,
        question_type: 'MultipleChoice',
        points: 1,
        options: [],
        answers: []
      };
      
      if (qText.toLowerCase().includes('match') || qText.toLowerCase().includes('pair')) {
        currentQuestion.question_type = 'Matching';
      } else if (qText.toLowerCase().includes('identify') || qText.toLowerCase().includes('what is') || qText.toLowerCase().includes('who is')) {
        currentQuestion.question_type = 'Identification';
      }
      continue;
    }
    
    if (!currentQuestion) continue;
    
    // Detect multiple choice options
    const optionMatch = line.match(/^([a-dA-D])[.)\s]+(.+)/);
    if (optionMatch && currentQuestion.question_type === 'MultipleChoice') {
      const optionText = optionMatch[2].trim();
      const isCorrect = line.includes('*') || line.includes('(correct)') || line.includes('[correct]');
      currentQuestion.options.push({
        option_text: optionText.replace(/[\*\(\)\[\]correct]/gi, '').trim(),
        is_correct: isCorrect
      });
      continue;
    }
    
    // Detect answer for identification questions
    const answerMatch = line.match(/^(?:Answer|Ans)[:.]?\s*(.+)/i);
    if (answerMatch && currentQuestion.question_type === 'Identification') {
      const answers = answerMatch[1].split(/[,;]/).map(a => a.trim()).filter(a => a);
      currentQuestion.answers.push(...answers);
      continue;
    }
    
    // Detect matching pairs
    const matchPair = line.match(/^([^-:]+)\s*[-:]\s*(.+)/);
    if (matchPair && currentQuestion.question_type === 'Matching') {
      const [, term, match] = matchPair;
      currentQuestion.options.push({
        option_text: term.trim(),
        match_text: match.trim(),
        is_correct: false
      });
    }
  }
  
  // Don't forget the last question
  if (currentQuestion) {
    if (currentQuestion.question_type === 'MultipleChoice' && currentQuestion.options.length >= 2) {
      questions.push(currentQuestion);
    } else if (currentQuestion.question_type === 'Identification' && currentQuestion.answers.length > 0) {
      questions.push(currentQuestion);
    } else if (currentQuestion.question_type === 'Matching' && currentQuestion.options.length > 0) {
      questions.push(currentQuestion);
    }
  }
  
  return { questions, errors };
}

export const POST = apiHandler(async (req: NextRequest) => {
  requireRole(req, ['Faculty', 'Admin']);

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) throw { status: 422, message: 'No file provided.' };

  const ext = file.name.toLowerCase().split('.').pop();
  const allowedExts = ['csv', 'pdf', 'docx', 'doc', 'txt'];
  
  if (!allowedExts.includes(ext || '')) {
    throw { status: 422, message: 'Only CSV, PDF, DOCX, DOC, and TXT files are supported.' };
  }

  const buffer = await file.arrayBuffer();
  let questions: any[] = [];
  let errors: string[] = [];

  // Handle different file types
  if (ext === 'csv') {
    const text = await file.text();
    const rows = parseCSV(text);
    if (rows.length < 2) throw { status: 422, message: 'File is empty or has no data rows.' };

    const header = rows[0].map(h => h.toLowerCase().trim());
    const typeIdx   = header.indexOf('type');
    const textIdx   = header.indexOf('question');
    const pointsIdx = header.indexOf('points');

    if (typeIdx === -1 || textIdx === -1) {
      throw { status: 422, message: 'CSV must have "type" and "question" columns. Download the template.' };
    }

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const rawType = row[typeIdx]?.trim().toLowerCase() || '';
      const qText   = row[textIdx]?.trim() || '';
      const pts     = parseFloat(row[pointsIdx]) || 1;

      if (!qText) { errors.push(`Row ${i + 1}: empty question text.`); continue; }

      if (rawType === 'identification' || rawType === 'id') {
        const ans: string[] = [];
        for (let c = 3; c < Math.min(row.length, 8); c++) {
          if (row[c]?.trim()) ans.push(row[c].trim());
        }
        if (!ans.length) { errors.push(`Row ${i + 1}: Identification question has no accepted answers.`); continue; }
        questions.push({ question_text: qText, question_type: 'Identification', points: pts, answers: ans });
      } else if (rawType === 'multiplechoice' || rawType === 'mcq' || rawType === 'mc') {
        const optStart = 3;
        const opts: { option_text: string; is_correct: boolean }[] = [];
        const correctCol = header.indexOf('correct');
        for (let c = optStart; c < row.length; c++) {
          if (row[c]?.trim()) opts.push({ option_text: row[c].trim(), is_correct: false });
        }
        if (correctCol !== -1 && row[correctCol]) {
          const correctNum = parseInt(row[correctCol]) - 1;
          if (opts[correctNum]) opts[correctNum].is_correct = true;
        } else if (opts.length) {
          opts[0].is_correct = true;
        }
        if (opts.length < 2) { errors.push(`Row ${i + 1}: MCQ needs at least 2 options.`); continue; }
        questions.push({ question_text: qText, question_type: 'MultipleChoice', points: pts, options: opts });
      } else if (rawType === 'matching' || rawType === 'match') {
        const pairStart = 3;
        const pairs: { option_text: string; match_text: string }[] = [];
        for (let c = pairStart; c < row.length - 1; c += 2) {
          if (row[c]?.trim() && row[c + 1]?.trim()) {
            pairs.push({ option_text: row[c].trim(), match_text: row[c + 1].trim() });
          }
        }
        if (!pairs.length) { errors.push(`Row ${i + 1}: Matching question has no pairs.`); continue; }
        const opts = pairs.map((p, idx) => ({ option_text: p.option_text, is_correct: false, match_text: p.match_text, position: idx }));
        questions.push({ question_text: qText, question_type: 'Matching', points: pts, options: opts });
      } else {
        errors.push(`Row ${i + 1}: Unknown type "${row[typeIdx]}". Use: Identification, MultipleChoice, or Matching.`);
      }
    }
  } else if (ext === 'pdf') {
    const text = await extractPDFText(buffer);
    const result = parseQuestionsFromText(text);
    questions = result.questions;
    errors = result.errors;
  } else if (ext === 'docx' || ext === 'doc') {
    const text = await extractDOCXText(buffer);
    const result = parseQuestionsFromText(text);
    questions = result.questions;
    errors = result.errors;
  } else if (ext === 'txt') {
    const text = await file.text();
    const result = parseQuestionsFromText(text);
    questions = result.questions;
    errors = result.errors;
  }

  return json({
    success: true,
    data: { questions, errors },
    message: `Parsed ${questions.length} question(s) from ${ext?.toUpperCase()}.${errors.length ? ` ${errors.length} issue(s) found.` : ''}`,
  });
});
