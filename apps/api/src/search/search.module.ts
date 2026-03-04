import { Global, Module } from '@nestjs/common';
import { TypesenseProvider } from './typesense.provider';
import { FoodIndexerService } from './food-indexer.service';

@Global()
@Module({
  providers: [TypesenseProvider, FoodIndexerService],
  exports: [TypesenseProvider, FoodIndexerService],
})
export class SearchModule {}
