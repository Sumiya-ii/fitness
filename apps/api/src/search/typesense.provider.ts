import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { Client as TypesenseClient } from 'typesense';
import { ConfigService } from '../config';

const FOODS_COLLECTION = 'foods';

const FOODS_SCHEMA = {
  name: FOODS_COLLECTION,
  fields: [
    { name: 'id', type: 'string' as const },
    { name: 'name', type: 'string' as const },
    { name: 'name_mn', type: 'string' as const, optional: true },
    { name: 'name_en', type: 'string' as const, optional: true },
    { name: 'aliases', type: 'string[]' as const, optional: true },
    { name: 'locale', type: 'string' as const, facet: true },
    { name: 'calories_per_100g', type: 'float' as const },
    { name: 'protein_per_100g', type: 'float' as const },
    { name: 'barcodes', type: 'string[]' as const, optional: true },
    { name: 'source_type', type: 'string' as const, facet: true },
  ],
  default_sorting_field: 'calories_per_100g' as const,
};

export interface FoodSearchDocument {
  id: string;
  name: string;
  name_mn?: string;
  name_en?: string;
  aliases?: string[];
  locale: string;
  calories_per_100g: number;
  protein_per_100g: number;
  barcodes?: string[];
  source_type: string;
}

@Injectable()
export class TypesenseProvider implements OnModuleInit {
  private client: TypesenseClient | null = null;
  private readonly logger = new Logger(TypesenseProvider.name);

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const host = this.config.get('TYPESENSE_HOST');
    const port = this.config.get('TYPESENSE_PORT');
    const apiKey = this.config.get('TYPESENSE_API_KEY');

    if (!host || !apiKey) {
      this.logger.warn(
        'Typesense not configured (TYPESENSE_HOST or TYPESENSE_API_KEY missing). Search indexing disabled.',
      );
      return;
    }

    this.client = new TypesenseClient({
      nodes: [{ host, port: port ?? 8108, protocol: 'http' }],
      apiKey,
      connectionTimeoutSeconds: 5,
    });

    await this.ensureCollection();
  }

  get isAvailable(): boolean {
    return this.client !== null;
  }

  private async ensureCollection() {
    if (!this.client) return;
    try {
      await this.client.collections(FOODS_COLLECTION).retrieve();
    } catch {
      await this.client.collections().create(FOODS_SCHEMA);
      this.logger.log('Created Typesense foods collection');
    }
  }

  async upsertDocuments(docs: FoodSearchDocument[]): Promise<number> {
    if (!this.client || docs.length === 0) return 0;

    const results = await this.client
      .collections(FOODS_COLLECTION)
      .documents()
      .import(docs, { action: 'upsert' });

    const successes = results.filter(
      (r: { success: boolean }) => r.success,
    ).length;
    const failures = results.filter(
      (r: { success: boolean }) => !r.success,
    );
    if (failures.length > 0) {
      this.logger.warn(`${failures.length} documents failed to index`);
    }
    return successes;
  }

  async search(query: string, locale?: string, page = 1, perPage = 20) {
    if (!this.client) return { hits: [], found: 0 };

    const searchParams: Record<string, string | number> = {
      q: query,
      query_by: 'name,name_mn,name_en,aliases',
      per_page: perPage,
      page,
    };

    if (locale) {
      searchParams.filter_by = `locale:=${locale}`;
    }

    return this.client
      .collections(FOODS_COLLECTION)
      .documents()
      .search(searchParams);
  }

  async deleteDocument(id: string) {
    if (!this.client) return;
    try {
      await this.client
        .collections(FOODS_COLLECTION)
        .documents(id)
        .delete();
    } catch {
      this.logger.warn(`Failed to delete document ${id} from search index`);
    }
  }
}
