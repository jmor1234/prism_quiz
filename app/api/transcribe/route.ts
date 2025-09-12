// app/api/transcribe/route.ts

import { openai } from '@ai-sdk/openai';
import { experimental_transcribe as transcribe } from 'ai';

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File;

    if (!audioFile) {
      return Response.json({ error: 'No audio file provided' }, { status: 400 });
    }

    if (!audioFile.type || !audioFile.type.startsWith('audio/')) {
      return Response.json({ error: 'Invalid audio file type' }, { status: 400 });
    }

    // Convert File to ArrayBuffer for AI SDK (server-side types expect ArrayBuffer)
    const audioBuffer = await audioFile.arrayBuffer();

    const result = await transcribe({
      model: openai.transcription('gpt-4o-transcribe'),
      audio: audioBuffer,
    });

    return Response.json({ text: result.text });
  } catch (error) {
    console.error('Transcription error:', error);
    return Response.json(
      { error: 'Transcription failed' },
      { status: 500 }
    );
  }
}
