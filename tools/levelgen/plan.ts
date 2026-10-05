import type { LevelRecipe } from './recipe';
import { RECIPES } from './recipes';
import { chooseTypes, planTypes } from './types';

let plan: Map<number, string[]> | null = null;

/**
 * The item types a recipe's level uses: for the game's recipes, from the rotation over all of them in level
 * order (planTypes); for any other recipe (tests), worked out on its own.
 */
export function typesFor(recipe: LevelRecipe): string[] {
  if (RECIPES.includes(recipe)) {
    plan ??= planTypes(RECIPES);
    return plan.get(recipe.number)!;
  }
  return recipe.fixedTypes ? [...recipe.fixedTypes] : chooseTypes(recipe.number, recipe.types, new Map());
}
