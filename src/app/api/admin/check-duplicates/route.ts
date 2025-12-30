import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

interface QuestionToCheck {
  question: string;
  _originalQuestion?: string;
}

// POST /api/admin/check-duplicates - Check which questions already exist in DB
export async function POST(request: NextRequest) {
  try {
    const { questions } = await request.json();

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json({ duplicates: [] });
    }

    // Generate hashes from ORIGINAL question texts (English)
    // This is what we use as externalId in the database
    const hashes = questions.map((q: QuestionToCheck) => {
      // Use original question if available (for duplicate detection after translation)
      const text = (q._originalQuestion || q.question).toLowerCase().replace(/\s+/g, ' ').trim();
      let hash = 0;
      for (let i = 0; i < text.length; i++) {
        const char = text.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return `hash_${Math.abs(hash).toString(16)}`;
    });

    // Check for existing questions by externalId (hash)
    // This is the primary method - matches original English text hash
    const existingByHash = await prisma.question.findMany({
      where: {
        externalId: { in: hashes },
      },
      select: {
        externalId: true,
        text: true,
        content: true,
        category: {
          select: { name: true, icon: true },
        },
      },
    });

    // Build a map of duplicate indices
    const duplicateIndices: number[] = [];
    const duplicateInfo: { index: number; category: string }[] = [];

    const hashSet = new Set(existingByHash.map(e => e.externalId));
    const hashToCategory = new Map(existingByHash.map(e => [e.externalId, e.category]));

    questions.forEach((q: QuestionToCheck, index: number) => {
      const hash = hashes[index];
      
      if (hashSet.has(hash)) {
        duplicateIndices.push(index);
        const cat = hashToCategory.get(hash);
        duplicateInfo.push({ 
          index, 
          category: cat ? `${cat.icon} ${cat.name}` : 'Unbekannt' 
        });
      }
    });

    return NextResponse.json({
      duplicates: duplicateIndices,
      duplicateInfo,
      total: questions.length,
      duplicateCount: duplicateIndices.length,
      newCount: questions.length - duplicateIndices.length,
    });
  } catch (error) {
    console.error('Duplicate check error:', error);
    return NextResponse.json(
      { error: 'Fehler beim Prüfen auf Duplikate' },
      { status: 500 }
    );
  }
}
