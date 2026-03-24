import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import Big from 'big.js';

@ValidatorConstraint({ name: 'isValidAmount', async: false })
export class IsValidAmountConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments): boolean {
    if (value === null || value === undefined) {
      return false;
    }

    try {
      const amount = new Big(value);

      // Check if it's positive
      if (amount.lte(0)) {
        return false;
      }

      // Check if it has more than 7 decimal places (Stellar precision)
      const stringValue = value.toString();
      if (stringValue.includes('.')) {
        const decimals = stringValue.split('.')[1].length;
        if (decimals > 7) {
          return false;
        }
      }

      // Check maximum amount (Stellar max: 922,337,203,685.4775807)
      const maxAmount = new Big('922337203685.4775807');
      if (amount.gt(maxAmount)) {
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must be a valid positive amount with maximum 7 decimal places and within Stellar limits`;
  }
}

@ValidatorConstraint({ name: 'isValidPercentage', async: false })
export class IsValidPercentageConstraint implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments): boolean {
    if (value === null || value === undefined) {
      return false;
    }

    try {
      const percentage = new Big(value);

      // Check if it's between 0 and 100
      if (percentage.lt(0) || percentage.gt(100)) {
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must be a valid percentage between 0 and 100`;
  }
}