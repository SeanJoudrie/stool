/**
 * Food auto-tagging.
 *
 * Correlation works on *tags*, not on item names — "cheese", "pizza" and
 * "mac and cheese" have to collapse into `dairy` before any pattern can show
 * up. This is a keyword dictionary rather than a model because it has to run
 * offline, instantly, and identically every time. It is deliberately
 * conservative: a missed tag costs a little signal, a wrong tag invents a
 * correlation that isn't there.
 *
 * Tags are always shown to the user before an entry saves, and are editable.
 */
import type { FoodTag } from '../db/schema'

interface Rule {
  /** Matched on word boundaries against the normalised item text. */
  match: string[]
  tags: FoodTag[]
}

const RULES: Rule[] = [
  // Dairy
  { match: ['milk', 'cheese', 'cheddar', 'mozzarella', 'parmesan', 'queso', 'yogurt', 'yoghurt', 'cream', 'creamer', 'ice cream', 'milkshake', 'latte', 'cappuccino', 'butter', 'custard', 'cheesecake', 'ranch', 'alfredo', 'queso fresco', 'gelato', 'half and half'], tags: ['dairy'] },
  { match: ['coleslaw', 'slaw', 'mac and cheese', 'macaroni and cheese', 'grilled cheese', 'quesadilla', 'nachos'], tags: ['dairy', 'high-fat'] },
  { match: ['pizza'], tags: ['dairy', 'high-fat', 'gluten'] },

  // Fat and frying
  { match: ['fried', 'deep fried', 'fries', 'french fries', 'tempura', 'donut', 'doughnut', 'churro', 'fritter', 'hash brown', 'tater tot', 'onion ring', 'wings', 'katsu', 'schnitzel'], tags: ['fried', 'high-fat'] },
  { match: ['bacon', 'sausage', 'gravy', 'mayo', 'mayonnaise', 'aioli', 'burger', 'cheeseburger', 'big mac', 'whopper', 'avocado', 'peanut butter', 'nutella', 'lard', 'duck', 'brisket', 'ribs', 'pork belly'], tags: ['high-fat'] },

  // Cured and processed meat
  { match: ['hotdog', 'hot dog', 'pastrami', 'salami', 'pepperoni', 'prosciutto', 'bologna', 'deli meat', 'lunch meat', 'jerky', 'ham', 'corned beef', 'chorizo', 'bratwurst', 'kielbasa', 'spam'], tags: ['cured-meat', 'high-fat'] },

  // Red meat
  { match: ['steak', 'beef', 'chili', 'chilli', 'meatloaf', 'meatball', 'lamb', 'venison', 'roast beef', 'ground beef'], tags: ['red-meat'] },

  // Spice
  { match: ['spicy', 'hot sauce', 'sriracha', 'jalapeno', 'jalapeño', 'habanero', 'chipotle', 'curry', 'kimchi', 'buffalo sauce', 'cayenne', 'salsa', 'wasabi', 'harissa'], tags: ['spicy'] },

  // Fibre
  { match: ['salad', 'broccoli', 'spinach', 'kale', 'oatmeal', 'oats', 'bran', 'whole wheat', 'whole grain', 'quinoa', 'brown rice', 'lentil', 'chia', 'flax', 'berries', 'raspberries', 'pear', 'prunes', 'artichoke', 'brussels sprouts', 'sweet potato', 'popcorn', 'psyllium', 'metamucil'], tags: ['high-fiber'] },
  { match: ['beans', 'black beans', 'chickpeas', 'hummus', 'refried beans', 'edamame', 'peas', 'tofu'], tags: ['legumes', 'high-fiber'] },

  // Gluten
  { match: ['bread', 'toast', 'bagel', 'pasta', 'spaghetti', 'noodles', 'sandwich', 'sub', 'wrap', 'tortilla', 'cracker', 'pretzel', 'biscuit', 'muffin', 'pancake', 'waffle', 'croissant', 'bun', 'roll', 'pie crust', 'cereal', 'couscous', 'ramen'], tags: ['gluten'] },

  // Alcohol
  { match: ['beer', 'wine', 'whiskey', 'whisky', 'vodka', 'tequila', 'rum', 'gin', 'cocktail', 'seltzer hard', 'ipa', 'bourbon', 'margarita', 'shots', 'liquor', 'cider hard', 'prosecco', 'champagne'], tags: ['alcohol'] },

  // Caffeine
  { match: ['coffee', 'espresso', 'cold brew', 'tea', 'green tea', 'black tea', 'energy drink', 'red bull', 'monster', 'celsius', 'pre workout', 'preworkout', 'matcha'], tags: ['caffeine'] },

  // Sweeteners and sugar
  { match: ['sugar free', 'sugar-free', 'diet soda', 'zero sugar', 'splenda', 'aspartame', 'stevia', 'erythritol', 'xylitol', 'sorbitol', 'sugar alcohol', 'protein bar', 'gum'], tags: ['artificial-sweetener'] },
  { match: ['candy', 'cookie', 'cookies', 'cake', 'brownie', 'pie', 'soda', 'coke', 'pepsi', 'sprite', 'gatorade', 'powerade', 'juice', 'lemonade', 'syrup', 'honey', 'frosting', 'chocolate', 'pastry', 'danish', 'sweet tea'], tags: ['high-sugar'] },

  // Raw produce
  { match: ['raw', 'lettuce', 'sprouts', 'cucumber', 'tomato', 'carrot sticks', 'celery', 'coleslaw raw', 'sushi', 'ceviche', 'oysters raw'], tags: ['raw-produce'] },

  // Shellfish and eggs
  { match: ['shrimp', 'crab', 'lobster', 'oyster', 'clam', 'mussel', 'scallop', 'shellfish'], tags: ['shellfish'] },
  { match: ['egg', 'eggs', 'omelette', 'omelet', 'scrambled eggs', 'frittata', 'deviled eggs'], tags: ['egg'] },

  // FODMAP staples
  { match: ['onion', 'garlic', 'shallot', 'leek', 'onions'], tags: ['onion-garlic'] },

  // Carbonation
  { match: ['soda', 'sparkling', 'seltzer', 'carbonated', 'la croix', 'club soda'], tags: ['carbonated'] },

  // Context
  { match: ['mre', 'field ration', 'first strike ration', 'chow hall', 'dfac', 'meal ready to eat'], tags: ['field-food'] },
  { match: ['restaurant', 'takeout', 'take out', 'delivery', 'drive thru', 'drive-thru', 'mcdonalds', "mcdonald's", 'wendys', "wendy's", 'chipotle grill', 'taco bell', 'burger king', 'chick fil a', 'chick-fil-a', 'subway', 'dennys', "denny's", 'diner', 'buffet', 'food truck'], tags: ['restaurant'] },
]

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Compiled once at module load — this runs on every keystroke of the food
 * field, and rebuilding a few hundred RegExps per call would be felt.
 *
 * The boundary groups are what keep "ham" out of "hamburger" and "tea" out of
 * "steak"; the optional trailing `s` catches plurals without a stemmer.
 */
const COMPILED: { keyword: string; pattern: RegExp; tags: FoodTag[] }[] = RULES.flatMap((rule) =>
  rule.match.map((keyword) => ({
    keyword,
    pattern: new RegExp(`(^|[^a-z0-9])${escapeRegExp(keyword)}s?([^a-z0-9]|$)`),
    tags: rule.tags,
  })),
).sort((a, b) => b.keyword.length - a.keyword.length)

export function normalizeFoodText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9'\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Tags implied by a single item name. */
export function autoTagItem(item: string): FoodTag[] {
  const text = normalizeFoodText(item)
  if (!text) return []
  const found = new Set<FoodTag>()
  for (const { pattern, tags } of COMPILED) {
    if (pattern.test(text)) for (const t of tags) found.add(t)
  }
  return [...found]
}

export function autoTagItems(items: string[]): FoodTag[] {
  const found = new Set<FoodTag>()
  for (const item of items) for (const t of autoTagItem(item)) found.add(t)
  return [...found]
}

/**
 * Splits a spoken or typed list into individual items:
 * "a hotdog, some chili and rice" → ["hotdog", "chili", "rice"].
 */
export function splitItems(text: string): string[] {
  return text
    .split(/,|\band\b|\bwith\b|\bplus\b|\balso\b|\/|\n|;/i)
    .map((s) =>
      s
        .replace(/^\s*(a|an|the|some|couple( of)?|few|bunch of|bit of|little|lot of|my|i had|i ate|had|ate)\s+/i, '')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter((s) => s.length > 0 && s.length < 60)
}

/** Offered as autocomplete on the food screen, so logging stays fast. */
export const COMMON_FOODS: readonly string[] = [
  'Coffee', 'Eggs', 'Oatmeal', 'Bagel', 'Toast', 'Banana', 'Greek yogurt', 'Protein shake',
  'Chicken and rice', 'Sandwich', 'Salad', 'Pizza', 'Burger', 'Fries', 'Burrito', 'Pasta',
  'Steak', 'Grilled chicken', 'Tuna', 'Soup', 'Chili', 'Hot dog', 'Cereal with milk',
  'Ice cream', 'Cookies', 'Chips', 'Energy drink', 'Beer', 'Water', 'Gatorade', 'MRE',
] as const
