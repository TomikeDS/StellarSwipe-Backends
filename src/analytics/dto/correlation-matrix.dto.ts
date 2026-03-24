export class CorrelationMatrixDto {
  correlationMatrix!: Record<string, Record<string, number>>;
  diversificationScore!: number;
  recommendations!: string[];
}
