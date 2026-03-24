import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { I18nAppService } from './i18n.service';

@Injectable()
export class I18nMiddleware implements NestMiddleware {
    constructor(private readonly i18nService: I18nAppService) { }

    use(req: Request, _res: Response, next: NextFunction) {
        // Determine requested language from header
        const acceptLanguage = req.headers['accept-language']?.split(',')[0];
        const customLangHeader = req.headers['x-custom-lang'] as string;

        // Use custom header if provided, otherwise accept-language
        const lang = customLangHeader || acceptLanguage || 'en';

        // Set standard supported language on the request object reference for other modules to use easily
        (req as any).language = this.i18nService.getSupportedLanguage(lang);

        next();
    }
}
