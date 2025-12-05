---
pageClass: rule-details
sidebarDepth: 0
title: vue/single-v-slot-style
description: enforce a specific style for single v-slot
---

# vue/single-v-slot-style

> enforce a specific style for single v-slot

- :exclamation: <badge text="This rule has not been released yet." vertical="middle" type="error"> _**This rule has not been released yet.**_ </badge>
- :wrench: The `--fix` option on the [command line](https://eslint.org/docs/user-guide/command-line-interface#fix-problems) can automatically fix some of the problems reported by this rule.

## :book: Rule Details

If a component has a single `v-slot` directive (commonly shortened as `#`), it's possible to remove an extra wrapper by moving this directive to the component directly, i.e. the following examples are equivalent:

```vue
<my-component>
  <template #default>...</template>
</my-component>

<my-component #default>...</my-component>
```

This rule can enforce a specific style in these cases.

<eslint-code-block fix :rules="{'vue/single-v-slot-style': ['error', 'without-wrapper']}">

```vue
<template>
  <!-- ✓ GOOD -->
  <my-component #default>...</my-component>

  <!-- ✗ BAD -->
  <my-component>
    <template #default>...</template>
  </my-component>
</template>
```

</eslint-code-block>

## :wrench: Options

```json
{
  "vue/single-v-slot-style": [
    "error",
    "without-wrapper" | "with-wrapper" |
    {
      "namedSlotStyle": "without-wrapper" | "with-wrapper",
      "defaultSlotStyle": "without-wrapper" | "with-wrapper",
      "treatCommentsAsInsignificant": boolean
    }
  ]
}
```

- `"without-wrapper"` (default) ... Enforces that the `v-slot` directive is placed directly on the component tag, removing the unnecessary `<template>` wrapper.
- `"with-wrapper"` ... Enforces that the `v-slot` directive is placed on a `<template>` tag wrapper.

<eslint-code-block fix :rules="{'vue/single-v-slot-style': ['error', 'with-wrapper']}">

```vue
<template>
  <!-- ✓ GOOD -->
  <my-component>
    <template #default>...</template>
  </my-component>

  <!-- ✗ BAD -->
  <my-component #default>...</my-component>
</template>
```

</eslint-code-block>

The default option is `"without-wrapper"`, which is equivalent to:

```json
{
  "namedSlotStyle": "without-wrapper",
  "defaultSlotStyle": "without-wrapper",
  "treatCommentsAsInsignificant": false
}
```

### `namedSlotStyle`

Specifies the style for named slots. Default is `"without-wrapper"`.

### `defaultSlotStyle`

Specifies the style for the default slot. Default inherits from `namedSlotStyle`.

### `treatCommentsAsInsignificant`

Default is `false`. If `true`, comments inside the component but outside the slot template are ignored when checking for "single slot" status. Note that fixing `without-wrapper` style will result in comments being inside the slot scope.

```vue
<template>
  <!-- treatCommentsAsInsignificant: false (default) -->
  <!-- This is valid because the comment makes it not a "single slot" case -->
  <my-component>
    <!-- comment -->
    <template #default>...</template>
  </my-component>

  <!-- treatCommentsAsInsignificant: true -->
  <!-- This is invalid and will be fixed to: -->
  <!-- <my-component #default><!-- comment -->...</my-component> -->
  <my-component>
    <!-- comment -->
    <template #default>...</template>
  </my-component>
</template>
```

## :books: Further Reading

- [Vue.js Guide - Named Slots](https://vuejs.org/guide/components/slots.html#named-slots)
- [Vue.js Guide - Scoped Slots](https://vuejs.org/guide/components/slots.html#scoped-slots)

## :mag: Implementation

- [Rule source](https://github.com/vuejs/eslint-plugin-vue/blob/master/lib/rules/single-v-slot-style.js)
- [Test source](https://github.com/vuejs/eslint-plugin-vue/blob/master/tests/lib/rules/single-v-slot-style.js)
