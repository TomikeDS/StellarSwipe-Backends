import { registerDecorator, ValidationOptions } from 'class-validator';
import { IsStellarAddressConstraint } from '../validators/stellar-address.validator';

/**
 * Decorator to validate Stellar address format (G... with 56 characters)
 */
export function IsStellarAddress(validationOptions?: ValidationOptions) {
    return function (object: Object, propertyName: string) {
        registerDecorator({
            target: object.constructor,
            propertyName: propertyName,
            options: validationOptions,
            constraints: [],
            validator: IsStellarAddressConstraint,
        });
    };
}
