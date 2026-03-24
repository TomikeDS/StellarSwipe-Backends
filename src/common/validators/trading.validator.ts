import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

@ValidatorConstraint({ name: 'isValidOrderType', async: false })
export class IsValidOrderTypeConstraint implements ValidatorConstraintInterface {
  private readonly validOrderTypes = [
    'market',
    'limit',
    'stop',
    'stop_limit',
    'iceberg',
    'oco',
    'trailing_stop'
  ];

  validate(value: any, args: ValidationArguments): boolean {
    if (typeof value !== 'string') {
      return false;
    }

    return this.validOrderTypes.includes(value.toLowerCase());
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must be a valid order type: ${this.validOrderTypes.join(', ')}`;
  }
}

@ValidatorConstraint({ name: 'isValidOrderSide', async: false })
export class IsValidOrderSideConstraint implements ValidatorConstraintInterface {
  private readonly validSides = ['buy', 'sell'];

  validate(value: any, args: ValidationArguments): boolean {
    if (typeof value !== 'string') {
      return false;
    }

    return this.validSides.includes(value.toLowerCase());
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must be either 'buy' or 'sell'`;
  }
}

@ValidatorConstraint({ name: 'isValidTimeInForce', async: false })
export class IsValidTimeInForceConstraint implements ValidatorConstraintInterface {
  private readonly validTIF = ['GTC', 'IOC', 'FOK', 'GTD'];

  validate(value: any, args: ValidationArguments): boolean {
    if (typeof value !== 'string') {
      return false;
    }

    return this.validTIF.includes(value.toUpperCase());
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must be a valid time in force: ${this.validTIF.join(', ')}`;
  }
}

@ValidatorConstraint({ name: 'isValidSignalType', async: false })
export class IsValidSignalTypeConstraint implements ValidatorConstraintInterface {
  private readonly validSignalTypes = [
    'buy',
    'sell',
    'hold',
    'strong_buy',
    'strong_sell',
    'neutral'
  ];

  validate(value: any, args: ValidationArguments): boolean {
    if (typeof value !== 'string') {
      return false;
    }

    return this.validSignalTypes.includes(value.toLowerCase());
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must be a valid signal type: ${this.validSignalTypes.join(', ')}`;
  }
}

@ValidatorConstraint({ name: 'isValidRiskLevel', async: false })
export class IsValidRiskLevelConstraint implements ValidatorConstraintInterface {
  private readonly validRiskLevels = ['low', 'medium', 'high', 'very_high'];

  validate(value: any, args: ValidationArguments): boolean {
    if (typeof value !== 'string') {
      return false;
    }

    return this.validRiskLevels.includes(value.toLowerCase());
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} must be a valid risk level: ${this.validRiskLevels.join(', ')}`;
  }
}