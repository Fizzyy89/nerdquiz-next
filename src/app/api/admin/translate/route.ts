import { NextRequest, NextResponse } from 'next/server';

interface OpenTDBQuestion {
  type: string;
  difficulty: string;
  category: string;
  question: string;
  correct_answer: string;
  incorrect_answers: string[];
  _originalQuestion?: string;
  _originalCorrectAnswer?: string;
  _originalIncorrectAnswers?: string[];
}

interface TranslatedQuestion {
  id?: number;
  question: string;
  correct_answer?: string;
  incorrect_answers?: string[];
}

// POST /api/admin/translate - Translate questions via OpenAI
export async function POST(request: NextRequest) {
  try {
    const { questions, apiKey } = await request.json();

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json(
        { error: 'Keine Fragen zum Übersetzen' },
        { status: 400 }
      );
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API Key fehlt' },
        { status: 400 }
      );
    }

    // Separate boolean and multiple choice questions
    // Boolean questions only need the question text translated, not the answers (True/False)
    const booleanQuestions: { originalIndex: number; question: OpenTDBQuestion }[] = [];
    const multipleChoiceQuestions: { originalIndex: number; question: OpenTDBQuestion }[] = [];
    
    questions.forEach((q: OpenTDBQuestion, idx: number) => {
      if (q.type === 'boolean') {
        booleanQuestions.push({ originalIndex: idx, question: q });
      } else {
        multipleChoiceQuestions.push({ originalIndex: idx, question: q });
      }
    });

    // Prepare multiple choice questions for translation (full translation)
    const mcQuestionsToTranslate = multipleChoiceQuestions.map(({ originalIndex, question }) => ({
      id: originalIndex,
      question: decodeHtmlEntities(question.question),
      correct_answer: decodeHtmlEntities(question.correct_answer),
      incorrect_answers: question.incorrect_answers.map(decodeHtmlEntities),
    }));
    
    // Prepare boolean questions for translation (only question text)
    const booleanQuestionsToTranslate = booleanQuestions.map(({ originalIndex, question }) => ({
      id: originalIndex,
      question: decodeHtmlEntities(question.question),
    }));

    // Build the prompt based on what we have
    let prompt = '';
    let hasMultipleChoice = mcQuestionsToTranslate.length > 0;
    let hasBoolean = booleanQuestionsToTranslate.length > 0;
    
    if (hasMultipleChoice && hasBoolean) {
      // Mixed: translate both types
      prompt = `Übersetze die folgenden Quiz-Fragen von Englisch ins Deutsche.
Behalte die Struktur exakt bei. Übersetze NUR den Text, ändere keine Fakten oder Informationen.
Bei Eigennamen, Filmtiteln, Spielen, etc. behalte den englischen Namen bei, wenn dieser im Deutschen üblicherweise verwendet wird.

Es gibt zwei Arten von Fragen:
1. Multiple-Choice-Fragen: Übersetze Frage UND alle Antworten
2. Wahr/Falsch-Fragen: Übersetze NUR die Frage (die Antworten True/False bleiben unverändert)

Antwort NUR mit gültigem JSON im folgenden Format:
{
  "multiple_choice": [
    { "id": 0, "question": "...", "correct_answer": "...", "incorrect_answers": ["...", "...", "..."] }
  ],
  "boolean": [
    { "id": 1, "question": "..." }
  ]
}

Multiple-Choice-Fragen:
${JSON.stringify(mcQuestionsToTranslate, null, 2)}

Wahr/Falsch-Fragen:
${JSON.stringify(booleanQuestionsToTranslate, null, 2)}`;
    } else if (hasMultipleChoice) {
      // Only multiple choice
      prompt = `Übersetze die folgenden Quiz-Fragen und ihre Antworten von Englisch ins Deutsche. 
Behalte die Struktur exakt bei. Übersetze NUR den Text, ändere keine Fakten oder Informationen.
Bei Eigennamen, Filmtiteln, Spielen, etc. behalte den englischen Namen bei, wenn dieser im Deutschen üblicherweise verwendet wird.

Antwort NUR mit gültigem JSON im folgenden Format:
{ "multiple_choice": [
  { "id": 0, "question": "...", "correct_answer": "...", "incorrect_answers": ["...", "...", "..."] }
] }

Hier sind die Fragen:
${JSON.stringify(mcQuestionsToTranslate, null, 2)}`;
    } else if (hasBoolean) {
      // Only boolean
      prompt = `Übersetze die folgenden Wahr/Falsch-Quiz-Fragen von Englisch ins Deutsche.
Übersetze NUR den Fragetext, NICHT die Antworten (True/False bleiben unverändert).
Bei Eigennamen, Filmtiteln, Spielen, etc. behalte den englischen Namen bei, wenn dieser im Deutschen üblicherweise verwendet wird.

Antwort NUR mit gültigem JSON im folgenden Format:
{ "boolean": [
  { "id": 0, "question": "..." }
] }

Hier sind die Fragen:
${JSON.stringify(booleanQuestionsToTranslate, null, 2)}`;
    } else {
      return NextResponse.json(
        { error: 'Keine Fragen zum Übersetzen' },
        { status: 400 }
      );
    }

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4.1',
        input: prompt,
        temperature: 0.3,
        text: {
          format: {
            type: 'json_object'
          }
        }
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('OpenAI API Error:', errorData);
      return NextResponse.json(
        { error: `OpenAI API Fehler: ${response.status} - ${errorData.error?.message || 'Unbekannter Fehler'}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // Extract the text from OpenAI response
    const outputText = data.output?.[0]?.content?.[0]?.text;
    
    if (!outputText) {
      console.error('Unexpected OpenAI response structure:', data);
      return NextResponse.json(
        { error: 'Unerwartete OpenAI Antwort-Struktur' },
        { status: 500 }
      );
    }

    // Parse the translated questions
    let translatedMC: TranslatedQuestion[] = [];
    let translatedBoolean: { id: number; question: string }[] = [];
    
    try {
      const parsed = JSON.parse(outputText);
      
      // Handle the structured response
      if (parsed.multiple_choice) {
        translatedMC = parsed.multiple_choice;
      }
      if (parsed.boolean) {
        translatedBoolean = parsed.boolean;
      }
      
      // Fallback for old format (direct array)
      if (Array.isArray(parsed)) {
        translatedMC = parsed;
      }
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', outputText);
      return NextResponse.json(
        { error: 'Fehler beim Parsen der OpenAI Antwort' },
        { status: 500 }
      );
    }

    // Merge translated content back with original metadata
    // IMPORTANT: Preserve _originalQuestion for duplicate detection!
    const result = questions.map((original: OpenTDBQuestion, idx: number) => {
      // Store original English text BEFORE translation overwrites it
      const originalQuestion = original._originalQuestion || original.question;
      const originalCorrectAnswer = original._originalCorrectAnswer || original.correct_answer;
      const originalIncorrectAnswers = original._originalIncorrectAnswers || original.incorrect_answers;
      
      if (original.type === 'boolean') {
        // For boolean questions, only update the question text, keep True/False as-is
        const translated = translatedBoolean.find((t) => t.id === idx);
        return {
          ...original,
          question: translated?.question || decodeHtmlEntities(original.question),
          correct_answer: original.correct_answer, // Keep True/False unchanged
          incorrect_answers: original.incorrect_answers, // Keep True/False unchanged
          _translated: !!translated,
          // Preserve originals for duplicate detection
          _originalQuestion: originalQuestion,
          _originalCorrectAnswer: originalCorrectAnswer,
          _originalIncorrectAnswers: originalIncorrectAnswers,
        };
      } else {
        // For multiple choice, translate everything
        const translated = translatedMC.find((t) => t.id === idx);
        return {
          ...original,
          question: translated?.question || decodeHtmlEntities(original.question),
          correct_answer: translated?.correct_answer || decodeHtmlEntities(original.correct_answer),
          incorrect_answers: translated?.incorrect_answers || original.incorrect_answers.map(decodeHtmlEntities),
          _translated: !!translated,
          // Preserve originals for duplicate detection
          _originalQuestion: originalQuestion,
          _originalCorrectAnswer: originalCorrectAnswer,
          _originalIncorrectAnswers: originalIncorrectAnswers,
        };
      }
    });

    return NextResponse.json({
      questions: result,
      usage: data.usage,
    });
  } catch (error) {
    console.error('Translation error:', error);
    return NextResponse.json(
      { error: 'Übersetzungsfehler: ' + (error instanceof Error ? error.message : 'Unbekannter Fehler') },
      { status: 500 }
    );
  }
}

// Decode HTML entities from OpenTDB
function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    '&quot;': '"',
    '&#039;': "'",
    '&apos;': "'",
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&nbsp;': ' ',
    '&ldquo;': '"',
    '&rdquo;': '"',
    '&lsquo;': "'",
    '&rsquo;': "'",
    '&mdash;': '—',
    '&ndash;': '–',
    '&hellip;': '…',
    '&eacute;': 'é',
    '&Eacute;': 'É',
    '&uuml;': 'ü',
    '&Uuml;': 'Ü',
    '&ouml;': 'ö',
    '&Ouml;': 'Ö',
    '&auml;': 'ä',
    '&Auml;': 'Ä',
    '&szlig;': 'ß',
  };

  let result = text;
  for (const [entity, char] of Object.entries(entities)) {
    result = result.replace(new RegExp(entity, 'g'), char);
  }
  
  // Handle numeric entities
  result = result.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));
  result = result.replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)));
  
  return result;
}

