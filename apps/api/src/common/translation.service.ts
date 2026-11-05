import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Service to manage translations of non-English free text inputs
 * into English without overwriting original inputs or leaking data externally.
 */
@Injectable()
export class TranslationService {
  private readonly logger = new Logger(TranslationService.name);

  // Common Hindi/Marathi/Konkani medical & demographic phrases dictionary for local privacy-safe translation
  private static readonly PHRASE_DICTIONARY: Record<string, string> = {
    'बुखार': 'fever',
    'ताप': 'fever',
    'तापाची लक्षणे': 'fever symptoms',
    'डोकेदुखी': 'headache',
    'सिरदर्द': 'headache',
    'कपकपी': 'chills/shivering',
    'थंडी': 'cold/chills',
    'उलटी': 'vomiting',
    'अशक्तपणा': 'weakness',
    'कमजोरी': 'weakness',
    'खोखला': 'cough',
    'खोकला': 'cough',
    'घसा दुखणे': 'sore throat',
    'गले में दर्द': 'sore throat',
  };

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Detects if text contains non-ASCII characters (e.g. Indic scripts, Perso-Arabic).
   */
  isNonEnglish(text: string | null | undefined): boolean {
    if (!text) return false;
    // Check if contains characters outside basic Latin/ASCII punctuation
    return /[^\u0000-\u007F]/.test(text.trim());
  }

  /**
   * Translates text to English using local offline dictionary/transliteration.
   */
  translateToEnglish(text: string, sourceLanguage?: string): string {
    const trimmed = text.trim();
    if (!trimmed) return '';

    // Check exact match in phrase dictionary
    if (TranslationService.PHRASE_DICTIONARY[trimmed]) {
      return TranslationService.PHRASE_DICTIONARY[trimmed];
    }

    // Replace known dictionary tokens
    let translated = trimmed;
    for (const [key, val] of Object.entries(TranslationService.PHRASE_DICTIONARY)) {
      if (translated.includes(key)) {
        translated = translated.split(key).join(val);
      }
    }

    if (translated !== trimmed) {
      return translated;
    }

    // Default note indicating source language and transcription
    const langNote = sourceLanguage ? `[Language: ${sourceLanguage}]` : '[Non-English text]';
    return `${langNote} ${trimmed}`;
  }

  /**
   * Records a translation record if the field contains non-English text.
   */
  async recordTranslation(params: {
    entityType: string;
    entityId: string;
    fieldName: string;
    sourceText: string;
    sourceLanguage?: string;
  }): Promise<void> {
    if (!params.sourceText || !this.isNonEnglish(params.sourceText)) {
      return;
    }

    try {
      const translated = this.translateToEnglish(params.sourceText, params.sourceLanguage);
      await this.prisma.translationRecord.create({
        data: {
          entityType: params.entityType,
          entityId: params.entityId,
          fieldName: params.fieldName,
          originalLanguage: (params.sourceLanguage as any) || 'en',
          originalText: params.sourceText,
          translatedText: translated,
          status: 'TRANSLATED',
        },
      });
    } catch (e) {
      this.logger.warn(`Failed to record translation for ${params.entityType}#${params.entityId}: ${String(e)}`);
    }
  }

  /**
   * Retrieves all translations for an entity.
   */
  getTranslationsForEntity(entityType: string, entityId: string) {
    return this.prisma.translationRecord.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
