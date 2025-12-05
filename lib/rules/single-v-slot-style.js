/**
 * @author rzzf
 * See LICENSE file in root directory for full license.
 */
'use strict'

const utils = require('../utils')

module.exports = {
  meta: {
    type: 'layout',
    docs: {
      description: 'enforce a specific style for single v-slot',
      categories: undefined,
      url: 'https://eslint.vuejs.org/rules/single-v-slot-style.html'
    },
    fixable: 'code',
    schema: [
      {
        oneOf: [
          {
            enum: ['with-wrapper', 'without-wrapper']
          },
          {
            type: 'object',
            properties: {
              namedSlotStyle: {
                enum: ['with-wrapper', 'without-wrapper']
              },
              defaultSlotStyle: {
                enum: ['with-wrapper', 'without-wrapper']
              },
              treatCommentsAsInsignificant: {
                type: 'boolean'
              }
            },
            additionalProperties: false
          }
        ]
      }
    ],
    messages: {
      expectedWithoutWrapper:
        'Expected single slot to be directly on the component.',
      expectedWithWrapper: 'Expected single slot to be in a <template> wrapper.'
    }
  },
  /** @param {RuleContext} context */
  create(context) {
    const options = context.options[0]
    const namedSlotStyle =
      (typeof options === 'string' ? options : options?.namedSlotStyle) ||
      'without-wrapper'
    const defaultSlotStyle =
      (typeof options === 'object' ? options?.defaultSlotStyle : null) ||
      namedSlotStyle
    const treatCommentsAsInsignificant =
      (typeof options === 'object'
        ? options?.treatCommentsAsInsignificant
        : null) || false

    /**
     * @param {VElement} node
     * @returns {boolean}
     */
    function isSlotTemplate(node) {
      return (
        node.name === 'template' &&
        utils.hasDirective(node, 'slot') &&
        node.startTag.attributes.every(
          (attr) => attr.directive && attr.key.name.name === 'slot'
        )
      )
    }

    /**
     * @param {VElement} node
     * @returns {VElement | null}
     */
    function getSingleSlotTemplate(node) {
      let slotTemplate = null
      for (const child of node.children) {
        if (child.type === 'VText') {
          if (child.value.trim()) {
            return null // Non-empty text
          }
          continue
        }
        if (child.type !== 'VElement') {
          // VExpressionContainer ({{ }})
          return null
        }
        if (isSlotTemplate(child)) {
          if (slotTemplate) {
            return null // More than one slot template
          }
          slotTemplate = child
        } else {
          // Other element
          return null
        }
      }
      return slotTemplate
    }

    return utils.defineTemplateBodyVisitor(context, {
      /** @param {VElement} node */
      VElement(node) {
        if (!utils.isCustomComponent(node)) {
          return
        }

        const slotsOnComponent = utils.getDirectives(node, 'slot')
        const slotTemplate = getSingleSlotTemplate(node)

        // Case 1: Slot on component
        if (slotsOnComponent.length === 1) {
          const slotDir = slotsOnComponent[0]
          // Check if there are other children that would make this not a "single slot" case
          // If slot is on component, it applies to children.
          // But wait, if slot is on component, it means it's the default slot (or named slot) consuming all children.
          // So effectively it IS a single slot.
          // EXCEPT if there are other named slots inside?
          // If `<my-comp #foo>...</my-comp>`, then `...` belongs to `#foo`.
          // You cannot have `<template #bar>` inside it.
          // So if there is a slot directive on the component, it is by definition a single slot (the one on the component).

          // However, we need to check if we should convert it to `with-wrapper`.
          const slotName =
            slotDir.key.argument && slotDir.key.argument.type === 'VIdentifier'
              ? slotDir.key.argument.name
              : 'default'
          const style =
            slotName === 'default' ? defaultSlotStyle : namedSlotStyle

          if (style === 'with-wrapper') {
            context.report({
              node: slotDir,
              messageId: 'expectedWithWrapper',
              fix(fixer) {
                // Fix: Move directive to a new <template> wrapper
                // <my-comp #foo>content</my-comp> -> <my-comp><template #foo>content</template></my-comp>
                const sourceCode = context.sourceCode
                const contentStart = node.startTag.range[1]
                const contentEnd = node.endTag
                  ? node.endTag.range[0]
                  : node.range[1]

                // Remove directive from component
                const tokenStore =
                  context.sourceCode.parserServices.getTemplateBodyTokenStore()
                const tokenBefore = tokenStore.getTokenBefore(slotDir)
                const removeDirective = fixer.removeRange([
                  tokenBefore.range[1],
                  slotDir.range[1]
                ])

                // Create template wrapper
                const directiveText = sourceCode.getText(slotDir)
                const content = sourceCode.text.slice(contentStart, contentEnd)

                // We need to be careful about self-closing tags
                if (node.startTag.selfClosing) {
                  // <my-comp #foo /> -> <my-comp><template #foo></template></my-comp>
                  // We need to change the component to be non-self-closing
                  const tagName = node.rawName
                  const newStartTag = sourceCode
                    .getText(node.startTag)
                    .replace(/\s*\/>$/u, '>')
                  const newEndTag = `</${tagName}>`
                  const newContent = `<template ${directiveText}></template>`

                  return fixer.replaceText(
                    node,
                    `${newStartTag
                      .replace(directiveText, '')
                      .replace(/\s+>/u, '>')
                      .replace(/\s+$/u, '')}${newContent}${newEndTag}`
                  )
                }

                const newContent = `<template ${directiveText}>${content}</template>`

                return [
                  removeDirective,
                  fixer.replaceTextRange([contentStart, contentEnd], newContent)
                ]
              }
            })
          }
        }

        // Case 2: Slot in <template> wrapper
        if (slotTemplate) {
          // Check if it's the ONLY thing (already done by getSingleSlotTemplate)
          // But we also need to check if there are comments if treatCommentsAsInsignificant is false
          // getSingleSlotTemplate ignores text whitespace.
          // What about comments?
          // In vue-eslint-parser, comments are not in `children`. They are separate.
          // We need to check token store or source code for comments between start tag and template, and template and end tag.

          if (!treatCommentsAsInsignificant && node.endTag) {
            const sourceCode = context.sourceCode
            const tokenStore =
              sourceCode.parserServices.getTemplateBodyTokenStore()

            // But we only care about comments OUTSIDE the slot template.
            // The slot template is `slotTemplate`.
            // So comments between `node.startTag` and `slotTemplate.startTag`
            // OR comments between `slotTemplate.endTag` and `node.endTag`.

            const commentsBefore = tokenStore
              .getTokensBetween(node.startTag, slotTemplate, {
                includeComments: true
              })
              .filter(
                (t) =>
                  t.type === 'Block' ||
                  t.type === 'Line' ||
                  t.type === 'HTMLComment'
              )
            const commentsAfter = tokenStore
              .getTokensBetween(slotTemplate, node.endTag, {
                includeComments: true
              })
              .filter(
                (t) =>
                  t.type === 'Block' ||
                  t.type === 'Line' ||
                  t.type === 'HTMLComment'
              )

            if (commentsBefore.length > 0 || commentsAfter.length > 0) {
              return // Has significant comments
            }
          }

          const slotDir = utils.getDirective(slotTemplate, 'slot')
          if (!slotDir) return // Should be there based on isSlotTemplate

          const slotName =
            slotDir.key.argument && slotDir.key.argument.type === 'VIdentifier'
              ? slotDir.key.argument.name
              : 'default'
          const style =
            slotName === 'default' ? defaultSlotStyle : namedSlotStyle

          if (style === 'without-wrapper') {
            context.report({
              node: slotTemplate,
              messageId: 'expectedWithoutWrapper',
              fix(fixer) {
                // Fix: Move directive to component and remove <template> wrapper
                // <my-comp><template #foo>content</template></my-comp> -> <my-comp #foo>content</my-comp>

                const sourceCode = context.sourceCode
                const directiveText = sourceCode.getText(slotDir)

                // Content of the template
                const templateContentStart = slotTemplate.startTag.range[1]
                const templateContentEnd = slotTemplate.endTag
                  ? slotTemplate.endTag.range[0]
                  : slotTemplate.range[1]
                const content = sourceCode.text.slice(
                  templateContentStart,
                  templateContentEnd
                )

                const componentStartTag = node.startTag
                let insertPosForDirective = componentStartTag.range[1] - 1
                if (componentStartTag.selfClosing) {
                  insertPosForDirective = componentStartTag.range[1] - 2
                }

                return [
                  fixer.insertTextBeforeRange(
                    [insertPosForDirective, insertPosForDirective],
                    ` ${directiveText}`
                  ),
                  fixer.replaceText(slotTemplate, content)
                ]
              }
            })
          }
        }
      }
    })
  }
}
