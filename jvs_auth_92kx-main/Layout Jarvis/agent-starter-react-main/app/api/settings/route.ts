import { NextResponse } from 'next/server';
import {
  getMissingSettings,
  readSettings,
  writeSettings,
  type JarvisSettings,
} from '@/lib/server/env-store';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const settings = await readSettings();

  return NextResponse.json({
    settings,
    missing: getMissingSettings(settings),
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<JarvisSettings>;
    const settings = await writeSettings(body);

    return NextResponse.json({
      settings,
      missing: getMissingSettings(settings),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao salvar configuracoes';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
