/**
 * Kategorie und Fragen Loader
 * Lädt Fragen aus den JSON-Dateien
 */

import fs from 'fs';
import path from 'path';

export interface QuestionData {
  question: string;
  answers: string[];
  correct: number;
  // Optionale Felder für Schätzfragen
  type?: 'choice' | 'estimation';
  unit?: string;
  correctValue?: number;
}

export interface CategoryData {
  name: string;
  icon: string;
  questions: QuestionData[];
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  questionCount: number;
}

// Cache für geladene Kategorien
let categoriesCache: Map<string, CategoryData> | null = null;

/**
 * Lädt alle Kategorien aus dem categories-Ordner
 */
export function loadCategories(): Map<string, CategoryData> {
  if (categoriesCache) {
    return categoriesCache;
  }

  const categoriesDir = path.join(process.cwd(), 'data', 'categories');
  const categories = new Map<string, CategoryData>();

  try {
    const files = fs.readdirSync(categoriesDir);
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(categoriesDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const data: CategoryData = JSON.parse(content);
        const id = file.replace('.json', '');
        categories.set(id, data);
      }
    }
  } catch (error) {
    console.error('Error loading categories:', error);
  }

  categoriesCache = categories;
  return categories;
}

/**
 * Gibt eine Liste aller verfügbaren Kategorien zurück
 */
export function getCategoryList(): Category[] {
  const categories = loadCategories();
  const list: Category[] = [];

  categories.forEach((data, id) => {
    list.push({
      id,
      name: data.name,
      icon: data.icon,
      questionCount: data.questions.length,
    });
  });

  // Sortiere nach Name
  return list.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Holt zufällige Fragen aus einer Kategorie
 */
export function getRandomQuestions(categoryId: string, count: number): QuestionData[] {
  const categories = loadCategories();
  const category = categories.get(categoryId);

  if (!category) {
    console.warn(`Category ${categoryId} not found`);
    return [];
  }

  // Shuffle und nimm die ersten `count` Fragen
  const shuffled = [...category.questions].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * Holt eine einzelne zufällige Frage aus einer Kategorie
 */
export function getRandomQuestion(categoryId: string): QuestionData | null {
  const questions = getRandomQuestions(categoryId, 1);
  return questions[0] || null;
}

/**
 * Holt N zufällige Kategorien für das Voting
 */
export function getRandomCategoriesForVoting(count: number = 6): Category[] {
  const allCategories = getCategoryList();
  const shuffled = [...allCategories].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

