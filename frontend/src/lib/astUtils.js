import * as acorn from 'acorn';
import * as walk from 'acorn-walk';

export function getCyclomaticComplexity(sourceCode) {
  let complexity = 1;
  try {
    const ast = acorn.parse(sourceCode, { ecmaVersion: 'latest', sourceType: 'module' });
    walk.simple(ast, {
      IfStatement: () => complexity++,
      ForStatement: () => complexity++,
      ForInStatement: () => complexity++,
      ForOfStatement: () => complexity++,
      WhileStatement: () => complexity++,
      DoWhileStatement: () => complexity++,
      SwitchCase: () => complexity++,
      LogicalExpression: (n) => { if (n.operator === '&&' || n.operator === '||') complexity++; },
      ConditionalExpression: () => complexity++,
      CatchClause: () => complexity++,
    });
  } catch {
    // non-JS/parse error → default complexity 1
  }
  return complexity;
}

export function complexityColor(score) {
  if (score <= 5) return '#10B981';
  if (score <= 10) return '#F59E0B';
  if (score <= 20) return '#F97316';
  return '#EF4444';
}

export function complexityLabel(score) {
  if (score <= 5) return 'Simple';
  if (score <= 10) return 'Moderate';
  if (score <= 20) return 'Complex';
  return 'Critical';
}

function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = Math.imul(31, h) + str.charCodeAt(i) | 0;
  return h.toString(36);
}

export function hashFunctions(sourceCode) {
  const hashes = new Map();
  try {
    const ast = acorn.parse(sourceCode, { ecmaVersion: 'latest', sourceType: 'module' });
    walk.simple(ast, {
      FunctionDeclaration(node) {
        const body = sourceCode.slice(node.body.start, node.body.end)
          .replace(/\s+/g, ' ').trim();
        if (body.length > 30) {
          hashes.set(node.id?.name || 'anonymous', simpleHash(body));
        }
      },
    });
  } catch {
    // ignore parse errors
  }
  return hashes;
}
