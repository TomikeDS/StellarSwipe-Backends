import {
    ValidatorConstraint,
    ValidatorConstraintInterface,
    ValidationArguments,
} from 'class-validator';
import Big from 'big.js';

@ValidatorConstraint({ name: 'isValidPrice', async: false })
export class IsValidPriceConstraint implements ValidatorConstraintInterface {
    validate(value: any, args: ValidationArguments): boolean {
        if (value === null || value === undefined) {
            return false;
        }

        try {
            const price = new Big(value);

            // Check if it's positive
            if (price.lte(0)) {
                return false;
            }

            // Check precision (max 10 decimals)
            const stringValue = value.toString();
            if (stringValue.includes('.')) {
                const decimals = stringValue.split('.')[1].length;
                if (decimals > 10) {
                    return false;
                }
            }

            // Check reasonable price bounds (example: max 1,000,000)
            const maxPrice = new Big('1000000');

            if (price.gt(maxPrice)) {
                return false;
            }

            return true;
        } catch (error) {
            return false;
        }
    }

    defaultMessage(args: ValidationArguments): string {
        return `${args.property} must be a valid positive price with maximum 10 decimal places and not exceeding 1,000,000`;
    }
}
