import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
    try {
        const [rows] = await pool.query('SELECT "TiDB Connected!" AS message');
        return NextResponse.json(rows);
    } catch (error) {
        return NextResponse.json({ error: 'DB connection failed' }, { status: 500 });
    }
}