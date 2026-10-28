import { NextResponse } from 'next/server';
import { controlRpc } from '@/lib/ad/rpc';
import { academyAdminSession } from '@/lib/academy/access';
import { questionCsv } from '@/lib/academy/questionImport';
import { createClient } from '@/lib/supabase/server';

type Row = {
  module_number: number;
  prompt: string;
  question_type: string;
  scenario: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct: string;
  explanation: string;
  concept: string;
  difficulty: string;
};

export async function GET() {
  const session = await academyAdminSession();
  if (!session) return new NextResponse('Academy admin access is required.', { status: 403 });
  const supabase = await createClient();
  const { data } = await controlRpc<Row[]>(supabase, 'academy_export_questions');
  const rows = (data ?? []).map((row) => ({
    'Module number': String(row.module_number),
    'Question text': row.prompt,
    Type: row.question_type,
    'Scenario setup': row.scenario,
    'Option A': row.option_a,
    'Option B': row.option_b,
    'Option C': row.option_c,
    'Option D': row.option_d,
    'Correct option': row.correct,
    Explanation: row.explanation,
    'Concept tag': row.concept,
    Difficulty: row.difficulty,
  }));
  return new NextResponse(questionCsv(rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="academy-questions.csv"',
    },
  });
}
