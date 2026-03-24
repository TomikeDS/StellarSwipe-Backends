import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { Asset } from '@stellar/stellar-sdk';

@ValidatorConstraint({ name: 'isAssetPair', async: false })
export class IsAssetPairConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments): boolean {
    if (typeof value !== 'string') {
      return false;
    }

    try {
      // Expected format: "CODE/CODE" or "CODE:ISSUER/CODE:ISSUER"
      const parts = value.split('/');
      if (parts.length !== 2) {
        return false;
      }

      const [baseAsset, counterAsset] = parts;

      // Validate each asset
      return this.isValidAsset(baseAsset) && this.isValidAsset(counterAsset);
    } catch (error) {
      return false;
    }
  }

  private isValidAsset(assetString: string): boolean {
    try {
      if (assetString === 'XLM' || assetString === 'native') {
        return true;
      }

      // Format: CODE:ISSUER
      const parts = assetString.split(':');
      if (parts.length !== 2) {
        return false;
      }

      const [code, issuer] = parts;

      // Validate asset code (1-12 alphanumeric characters)
      if (!/^[A-Z0-9]{1,12}$/.test(code)) {
        return false;
      }

      // Validate issuer (must be valid Stellar public key)
      if (!/^G[A-Z0-9]{55}$/.test(issuer)) {
        return false;
      }

      // Try to create Asset object to validate
      Asset.native();
      new Asset(code, issuer);

      return true;
    } catch (error) {
      return false;
    }
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must be a valid asset pair format (e.g., "CODE:ISSUER/CODE:ISSUER" or "XLM/CODE:ISSUER")`;
  }
}

@ValidatorConstraint({ name: 'isStellarAsset', async: false })
export class IsStellarAssetConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments): boolean {
    if (typeof value !== 'string') {
      return false;
    }

    try {
      if (value === 'XLM' || value === 'native') {
        return true;
      }

      // Format: CODE:ISSUER
      const parts = value.split(':');
      if (parts.length !== 2) {
        return false;
      }

      const [code, issuer] = parts;

      // Validate asset code (1-12 alphanumeric characters)
      if (!/^[A-Z0-9]{1,12}$/.test(code)) {
        return false;
      }

      // Validate issuer (must be valid Stellar public key)
      if (!/^G[A-Z0-9]{55}$/.test(issuer)) {
        return false;
      }

      // Try to create Asset object to validate
      new Asset(code, issuer);

      return true;
    } catch (error) {
      return false;
    }
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must be a valid Stellar asset (XLM or CODE:ISSUER format)`;
  }
}