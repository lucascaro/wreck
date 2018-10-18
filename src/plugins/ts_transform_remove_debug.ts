import * as ts from 'typescript';

export interface PluginConfig {
  remove?: string[];
}

export default function transform(program: ts.Program, config: PluginConfig) {
  console.log(config);
  const remove: string[] = config.remove || ['debug'];

  function visitor(ctx: ts.TransformationContext, sf: ts.SourceFile) {
    const visitor: ts.Visitor = (node: ts.Node): ts.VisitResult<ts.Node> => {
      // here we can check each node and potentially return
      // new nodes if we want to leave the node as is, and
      if (ts.isCallExpression(node)
        && remove.includes(node.expression.getText(sf))
      ) {
        return ts.createEmptyStatement();
      }
      // continue searching through child nodes:
      return ts.visitEachChild(node, visitor, ctx);
    };
    return visitor;
  }
  return (ctx: ts.TransformationContext): ts.Transformer<ts.SourceFile> => {
    return (sf: ts.SourceFile) => ts.visitNode(sf, visitor(ctx, sf));
  };
}
