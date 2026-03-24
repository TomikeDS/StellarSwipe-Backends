import { I18nMiddleware } from './i18n.middleware';

describe('I18nMiddleware', () => {
    let middleware: I18nMiddleware;
    let i18nServiceSpec: any;

    beforeEach(() => {
        i18nServiceSpec = {
            getSupportedLanguage: jest.fn().mockImplementation((lang) => {
                const supported = ['en', 'yo', 'ig', 'ha'];
                return supported.includes(lang) ? lang : 'en';
            }),
        };

        middleware = new I18nMiddleware(i18nServiceSpec);
    });

    it('should be defined', () => {
        expect(middleware).toBeDefined();
    });

    describe('use', () => {
        it('should set default language if no headers are provided', () => {
            const req: any = { headers: {} };
            const res: any = {};
            const next = jest.fn();

            middleware.use(req, res, next);

            expect(i18nServiceSpec.getSupportedLanguage).toHaveBeenCalledWith('en');
            expect(req.language).toBe('en');
            expect(next).toHaveBeenCalled();
        });

        it('should prioritize x-custom-lang over accept-language header', () => {
            const req: any = {
                headers: {
                    'accept-language': 'ha',
                    'x-custom-lang': 'yo',
                },
            };
            const res: any = {};
            const next = jest.fn();

            middleware.use(req, res, next);

            expect(i18nServiceSpec.getSupportedLanguage).toHaveBeenCalledWith('yo');
            expect(req.language).toBe('yo');
            expect(next).toHaveBeenCalled();
        });

        it('should use accept-language if x-custom-lang is not provided', () => {
            const req: any = {
                headers: {
                    'accept-language': 'ig,yo;q=0.9',
                },
            };
            const res: any = {};
            const next = jest.fn();

            middleware.use(req, res, next);

            // It splits by comma and takes the first part (ig)
            expect(i18nServiceSpec.getSupportedLanguage).toHaveBeenCalledWith('ig');
            expect(req.language).toBe('ig');
            expect(next).toHaveBeenCalled();
        });

        it('should fallback to en for unsupported languages in headers', () => {
            const req: any = {
                headers: {
                    'accept-language': 'fr-FR,fr;q=0.9',
                },
            };
            const res: any = {};
            const next = jest.fn();

            // Ensure mock correctly reflects service logic for fallback
            i18nServiceSpec.getSupportedLanguage.mockReturnValue('en');

            middleware.use(req, res, next);

            expect(i18nServiceSpec.getSupportedLanguage).toHaveBeenCalledWith('fr-FR');
            expect(req.language).toBe('en');
            expect(next).toHaveBeenCalled();
        });
    });
});
