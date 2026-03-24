import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { StrKey } from '@stellar/stellar-sdk';

@ValidatorConstraint({ name: 'isStellarAddress', async: false })
export class IsStellarAddressConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments): boolean {
    if (typeof value !== 'string') {
      return false;
    }

    try {
      // Check if it's a valid Stellar public key (G...)
      if (value.startsWith('G')) {
        return StrKey.isValidEd25519PublicKey(value);
      }

      // Check if it's a valid Stellar secret key (S...)
      if (value.startsWith('S')) {
        return StrKey.isValidEd25519SecretSeed(value);
      }

      // Check if it's a valid Muxed account (M...)
      if (value.startsWith('M')) {
        return StrKey.isValidMed25519PublicKey(value);
      }

      return false;
    } catch (error) {
      return false;
    }
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must be a valid Stellar address (public key starting with G, secret key starting with S, or muxed account starting with M)`;
  }
}

@ValidatorConstraint({ name: 'isStellarPublicKey', async: false })
export class IsStellarPublicKeyConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments): boolean {
    if (typeof value !== 'string') {
      return false;
    }

    try {
      return value.startsWith('G') && StrKey.isValidEd25519PublicKey(value);
    } catch (error) {
      return false;
    }
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must be a valid Stellar public key (56 characters starting with G)`;
  }
}

@ValidatorConstraint({ name: 'isStellarSecretKey', async: false })
export class IsStellarSecretKeyConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments): boolean {
    if (typeof value !== 'string') {
      return false;
    }

    try {
      return value.startsWith('S') && StrKey.isValidEd25519SecretSeed(value);
    } catch (error) {
      return false;
    }
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must be a valid Stellar secret key (56 characters starting with S)`;
  }
}