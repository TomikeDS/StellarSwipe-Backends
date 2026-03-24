import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';
import {
  IsStellarPublicKeyConstraint,
  IsStellarSecretKeyConstraint
} from '../validators/stellar-address.validator';
import { IsAssetPairConstraint, IsStellarAssetConstraint } from '../validators/asset-pair.validator';
import {
  IsValidAmountConstraint,
  IsValidPercentageConstraint,
} from '../validators/amount.validator';
import { IsValidPriceConstraint } from '../validators/price.validator';
import {
  IsValidOrderTypeConstraint,
  IsValidOrderSideConstraint,
  IsValidTimeInForceConstraint,
  IsValidSignalTypeConstraint,
  IsValidRiskLevelConstraint
} from '../validators/trading.validator';
import {
  IsValidDateRangeConstraint,
  IsFutureDateConstraint,
  IsValidExpirationDateConstraint,
  IsValidTimestampConstraint
} from '../validators/date.validator';


export function IsStellarPublicKey(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsStellarPublicKeyConstraint,
    });
  };
}

export function IsStellarSecretKey(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsStellarSecretKeyConstraint,
    });
  };
}

// Asset Validators
export function IsAssetPair(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsAssetPairConstraint,
    });
  };
}

export function IsStellarAsset(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsStellarAssetConstraint,
    });
  };
}

// Amount Validators
export function IsValidAmount(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidAmountConstraint,
    });
  };
}

export function IsValidPercentage(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidPercentageConstraint,
    });
  };
}

export function IsValidPrice(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidPriceConstraint,
    });
  };
}

// Trading Validators
export function IsValidOrderType(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidOrderTypeConstraint,
    });
  };
}

export function IsValidOrderSide(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidOrderSideConstraint,
    });
  };
}

export function IsValidTimeInForce(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidTimeInForceConstraint,
    });
  };
}

export function IsValidSignalType(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidSignalTypeConstraint,
    });
  };
}

export function IsValidRiskLevel(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidRiskLevelConstraint,
    });
  };
}

// Date Validators
export function IsValidDateRange(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidDateRangeConstraint,
    });
  };
}

export function IsFutureDate(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsFutureDateConstraint,
    });
  };
}

export function IsValidExpirationDate(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidExpirationDateConstraint,
    });
  };
}

export function IsValidTimestamp(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidTimestampConstraint,
    });
  };
}