import { colorBrands } from '../colors/colors.brands';
import { colorPrimitives } from '../colors/colors.primitives';

export const textColorSemantics = {
  'primary-color': { light: colorBrands['neutral-1000'], dark: colorBrands['neutral-100'] },
  'secondary-color': { light: colorBrands['neutral-800'], dark: colorBrands['neutral-300'] },
  'tertiary-color': { light: colorBrands['neutral-500'], dark: colorBrands['neutral-600'] },
  'link-color': { light: colorBrands['primary-600'], dark: colorBrands['primary-400'] },
  'disabled-color': { light: colorBrands['neutral-400'], dark: colorBrands['neutral-600'] },
  'primary-inverse': { light: colorPrimitives['white-100'], dark: colorPrimitives['black-100'] },

  'success-subtle-color': { light: colorBrands['success-100'], dark: colorBrands['success-700'] },
  'success-bold-color': { light: colorBrands['success-500'], dark: colorBrands['success-300'] },

  'danger-subtle-color': { light: colorBrands['danger-100'], dark: colorBrands['danger-700'] },
  'danger-bold-color': { light: colorBrands['danger-700'], dark: colorBrands['danger-300'] },

  'info-bold-color': { light: colorBrands['info-700'], dark: colorBrands['info-100'] },

};

export const textSemantics = {
  'heading-large-size': '26px',
  'heading-small-size': '20px',
  'heading-xsmall-size': '18px',
  'body-large-size': '16px',
  'body-size': '14px',
  'body-small-size': '12px',
  'body-xsmall-size': '10px',
};
