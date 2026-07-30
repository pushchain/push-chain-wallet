import { colorBrands } from '../colors/colors.brands';
import { colorPrimitives } from '../colors/colors.primitives';

export const surfaceSemantics = {
  'primary-color': { light: colorBrands['neutral-100'], dark: colorBrands['neutral-1000'] },
  'secondary-color': { light: colorPrimitives['white-100'], dark: colorBrands['neutral-900'] },
  'tertiary-color': { light: colorBrands['neutral-200'], dark: colorBrands['neutral-800'] },
  'disabled-color': { light: colorBrands['neutral-200'], dark: colorBrands['neutral-800'] },
  'primary-inverse': { light: colorPrimitives['black-100'], dark: colorPrimitives['white-100'] },
  'transparent': { light: colorPrimitives['transparent'], dark: colorPrimitives['transparent'] },
  'danger-subtle': { light: colorBrands['danger-100'], dark: colorBrands['danger-900'] },
  'danger-bold': { light: colorBrands['danger-500'], dark: colorBrands['danger-200'] },
  'info-subtle': { light: colorBrands['info-100'], dark: colorBrands['info-900'] },

};
