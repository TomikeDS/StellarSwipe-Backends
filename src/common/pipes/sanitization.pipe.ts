import {
    PipeTransform,
    Injectable,
    ArgumentMetadata,
    Logger,
} from '@nestjs/common';
import DOMPurify from 'isomorphic-dompurify';

@Injectable()
export class SanitizationPipe implements PipeTransform {
    private readonly logger = new Logger(SanitizationPipe.name);

    transform(value: any, metadata: ArgumentMetadata) {
        if (!value || typeof value !== 'object') {
            if (typeof value === 'string') {
                return this.sanitizeString(value);
            }
            return value;
        }

        try {
            return this.sanitizeObject(value);
        } catch (error) {
            this.logger.error(`Sanitization failed: ${error.message}`);
            return value;
        }
    }

    private sanitizeObject(obj: any): any {
        if (Array.isArray(obj)) {
            return obj.map(item => this.sanitizeObject(item));
        }

        if (obj && typeof obj === 'object') {
            const sanitized = {};

            for (const [key, value] of Object.entries(obj)) {
                const sanitizedKey = this.sanitizeString(key);
                sanitized[sanitizedKey] = this.sanitizeValue(value);
            }

            return sanitized;
        }

        return this.sanitizeValue(obj);
    }

    private sanitizeValue(value: any): any {
        if (typeof value === 'string') {
            return this.sanitizeString(value);
        }

        if (Array.isArray(value)) {
            return value.map(item => this.sanitizeObject(item));
        }

        if (value && typeof value === 'object') {
            return this.sanitizeObject(value);
        }

        return value;
    }

    private sanitizeString(str: string): string {
        if (typeof str !== 'string') {
            return str;
        }

        // Trim whitespace
        let sanitized = str.trim();

        // Remove HTML tags and potential XSS using DOMPurify
        sanitized = DOMPurify.sanitize(sanitized, {
            ALLOWED_TAGS: [], // No HTML allowed
            ALLOWED_ATTR: [],
        });

        // Remove null bytes and control characters
        sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');

        return sanitized;
    }
}
