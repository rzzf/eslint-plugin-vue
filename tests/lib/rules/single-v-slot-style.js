/**
 * @author rzzf
 * See LICENSE file in root directory for full license.
 */
'use strict'

const RuleTester = require('../../eslint-compat').RuleTester
const rule = require('../../../lib/rules/single-v-slot-style')

const tester = new RuleTester({
  languageOptions: {
    parser: require('vue-eslint-parser'),
    ecmaVersion: 2020,
    sourceType: 'module'
  }
})

tester.run('single-v-slot-style', rule, {
  valid: [
    // Default options (without-wrapper)
    {
      filename: 'test.vue',
      code: '<template><my-component #default>Content</my-component></template>'
    },
    {
      filename: 'test.vue',
      code: '<template><my-component #named>Content</my-component></template>'
    },
    {
      filename: 'test.vue',
      code: '<template><my-component>Content</my-component></template>'
    },
    {
      filename: 'test.vue',
      code: '<template><my-component><template #one>1</template><template #two>2</template></my-component></template>'
    },
    {
      filename: 'test.vue',
      code: '<template><my-component>Default<template #named>Named</template></my-component></template>'
    },
    // with-wrapper
    {
      filename: 'test.vue',
      code: '<template><my-component><template #default>Content</template></my-component></template>',
      options: ['with-wrapper']
    },
    {
      filename: 'test.vue',
      code: '<template><my-component><template #named>Content</template></my-component></template>',
      options: ['with-wrapper']
    },
    // Mixed styles
    {
      filename: 'test.vue',
      code: '<template><my-component><template #default>Content</template></my-component></template>',
      options: [
        { namedSlotStyle: 'without-wrapper', defaultSlotStyle: 'with-wrapper' }
      ]
    },
    {
      filename: 'test.vue',
      code: '<template><my-component #named>Content</my-component></template>',
      options: [
        { namedSlotStyle: 'without-wrapper', defaultSlotStyle: 'with-wrapper' }
      ]
    },
    // Comments
    {
      filename: 'test.vue',
      code: `
      <template>
        <my-component>
          <!-- comment -->
          <template #default>Content</template>
        </my-component>
      </template>`
    },
    {
      filename: 'test.vue',
      code: '<template><my-component #default><!-- comment -->Content</my-component></template>',
      options: [{ treatCommentsAsInsignificant: true }]
    }
  ],
  invalid: [
    // Default options (without-wrapper)
    {
      filename: 'test.vue',
      code: '<template><my-component><template #default>Content</template></my-component></template>',
      output:
        '<template><my-component #default>Content</my-component></template>',
      errors: [{ messageId: 'expectedWithoutWrapper' }]
    },
    {
      filename: 'test.vue',
      code: '<template><my-component><template #named>Content</template></my-component></template>',
      output:
        '<template><my-component #named>Content</my-component></template>',
      errors: [{ messageId: 'expectedWithoutWrapper' }]
    },
    // with-wrapper
    {
      filename: 'test.vue',
      code: '<template><my-component #default>Content</my-component></template>',
      output:
        '<template><my-component><template #default>Content</template></my-component></template>',
      options: ['with-wrapper'],
      errors: [{ messageId: 'expectedWithWrapper' }]
    },
    {
      filename: 'test.vue',
      code: '<template><my-component #named>Content</my-component></template>',
      output:
        '<template><my-component><template #named>Content</template></my-component></template>',
      options: ['with-wrapper'],
      errors: [{ messageId: 'expectedWithWrapper' }]
    },
    // Self-closing components
    {
      filename: 'test.vue',
      code: '<template><my-component #default /></template>',
      output:
        '<template><my-component><template #default></template></my-component></template>',
      options: ['with-wrapper'],
      errors: [{ messageId: 'expectedWithWrapper' }]
    },
    // Comments with treatCommentsAsInsignificant: true
    {
      filename: 'test.vue',
      code: `
      <template>
        <my-component>
          <!-- comment -->
          <template #default>Content</template>
        </my-component>
      </template>`,
      output: `
      <template>
        <my-component #default>
          <!-- comment -->
          Content
        </my-component>
      </template>`,
      options: [{ treatCommentsAsInsignificant: true }],
      errors: [{ messageId: 'expectedWithoutWrapper' }]
    }
  ]
})
