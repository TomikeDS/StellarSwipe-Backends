import { IsString, IsNumber, IsOptional, IsUUID, Min, Max, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PartialCloseDto {
    @ApiProperty({ description: 'ID of the trade/position to partially close' })
    @IsUUID()
    @IsNotEmpty()
    tradeId!: string;

    @ApiProperty({ description: 'User ID owning the trade' })
    @IsUUID()
    @IsNotEmpty()
    userId!: string;

    @ApiProperty({ description: 'Wallet address for transaction' })
    @IsString()
    @IsNotEmpty()
    walletAddress!: string;

    @ApiProperty({ description: 'Amount to close (if percentage is not provided)', required: false })
    @IsNumber()
    @IsOptional()
    @Min(0)
    amount?: number;

    @ApiProperty({ description: 'Percentage of position to close (1-100)', required: false })
    @IsNumber()
    @IsOptional()
    @Min(1)
    @Max(100)
    percentage?: number;

    @ApiProperty({ description: 'Optional exit price (uses market price if omitted)', required: false })
    @IsNumber()
    @IsOptional()
    @Min(0)
    exitPrice?: number;
}
