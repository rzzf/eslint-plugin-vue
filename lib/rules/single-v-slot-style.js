/**
 * @author rzzf
 * See LICENSE file in root directory for full license.
 */
'use strict'

const utils = require('../utils')

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

/**
 * @typedef {object} Options
 * @property {'with-wrapper' | 'without-wrapper'} namedSlotStyle
 * @property {'with-wrapper' | 'without-wrapper'} defaultSlotStyle
 * @property {boolean} treatCommentsAsInsignificant
 */

/**
 * Normalize options.
 * @param {any} options The raw options to normalize.
 * @returns {Options} The normalized options.
 */
function parseOptions(options) {
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

  return {
    namedSlotStyle,
    defaultSlotStyle,
    treatCommentsAsInsignificant
  }
}

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
    const { namedSlotStyle, defaultSlotStyle, treatCommentsAsInsignificant } =
      parseOptions(context.options[0])

    /**
     * @param {VElement} node
     * @param {VElement} slotTemplate
     * @returns {boolean}
     */
    function hasSignificantComments(node, slotTemplate) {
      if (treatCommentsAsInsignificant || !node.endTag) {
        return false
      }
      const sourceCode = context.sourceCode
      const tokenStore = sourceCode.parserServices.getTemplateBodyTokenStore()

      const commentsBefore = tokenStore
        .getTokensBetween(node.startTag, slotTemplate, {
          includeComments: true
        })
        .filter(
          (t) =>
            t.type === 'Block' || t.type === 'Line' || t.type === 'HTMLComment'
        )
      if (commentsBefore.length > 0) {
        return true
      }

      const commentsAfter = tokenStore
        .getTokensBetween(slotTemplate, node.endTag, {
          includeComments: true
        })
        .filter(
          (t) =>
            t.type === 'Block' || t.type === 'Line' || t.type === 'HTMLComment'
        )

      return commentsAfter.length > 0
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
          return
        }

        // Case 2: Slot in <template> wrapper
        if (slotTemplate) {
          if (hasSignificantComments(node, slotTemplate)) {
            return
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
