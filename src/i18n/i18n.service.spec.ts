import { Test, TestingModule } from '@nestjs/testing';
import { I18nAppService } from './i18n.service';
import { I18nService } from 'nestjs-i18n';

describe('I18nAppService', () => {
    let service: I18nAppService;
    let i18nServiceSpec: any;

    beforeEach(async () => {
        i18nServiceSpec = {
            translate: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                I18nAppService,
                {
                    provide: I18nService,
                    useValue: i18nServiceSpec,
                },
            ],
        }).compile();

        service = module.get<I18nAppService>(I18nAppService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('translate', () => {
        it('should successfully translate a known key', async () => {
            const translationKey = 'errors.INVALID_PRICE';
            const expectedTranslation = 'Invalid price provided';

            i18nServiceSpec.translate.mockResolvedValue(expectedTranslation);

            const result = await service.translate(translationKey, 'en');

            expect(i18nServiceSpec.translate).toHaveBeenCalledWith(translationKey, {
                lang: 'en',
                args: undefined,
            });
            expect(result).toBe(expectedTranslation);
        });

        it('should fallback to returning the key if translation fails', async () => {
            const translationKey = 'errors.UNKNOWN';

            i18nServiceSpec.translate.mockRejectedValue(new Error('Translation failed'));

            const result = await service.translate(translationKey, 'en');

            expect(result).toBe(translationKey);
        });
    });

    describe('getSupportedLanguage', () => {
        it('should return the requested language if supported', () => {
            expect(service.getSupportedLanguage('yo')).toBe('yo');
            expect(service.getSupportedLanguage('ig')).toBe('ig');
            expect(service.getSupportedLanguage('ha')).toBe('ha');
            expect(service.getSupportedLanguage('en')).toBe('en');
        });

        it('should parse base language correctly from complex locale', () => {
            expect(service.getSupportedLanguage('en-US')).toBe('en');
            expect(service.getSupportedLanguage('yo-NG')).toBe('yo');
        });

        it('should fallback to en for unsupported languages', () => {
            expect(service.getSupportedLanguage('fr')).toBe('en');
            expect(service.getSupportedLanguage('es-ES')).toBe('en');
            expect(service.getSupportedLanguage('')).toBe('en');
            expect(service.getSupportedLanguage(null as any)).toBe('en');
        });
    });
});
