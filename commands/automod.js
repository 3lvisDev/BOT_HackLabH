const {
  PermissionsBitField,
  AutoModerationRuleEventType,
  AutoModerationRuleTriggerType,
  AutoModerationActionType
} = require('discord.js');
const { resolveGuildLocale, resolveInteractionLocale, t } = require('../utils/i18n');

const RULE_NAME = 'HackLabH AutoMod Keywords';
const KEYWORD_LIMIT = 1000;

function normalizeWord(word) {
  return String(word || '').trim().toLowerCase();
}

function hasManageGuildPermission(member) {
  return member?.permissions?.has?.(PermissionsBitField.Flags.ManageGuild);
}

function hasBotManageGuildPermission(guild) {
  return guild?.members?.me?.permissions?.has?.(PermissionsBitField.Flags.ManageGuild);
}

function parseAutomodAction(raw) {
  const tokens = String(raw || '').trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return { type: 'help' };

  const head = tokens[0].toLowerCase();
  const second = (tokens[1] || '').toLowerCase();
  const rest = tokens.slice(2).join(' ');

  if (['status', 'estado'].includes(head)) return { type: 'status' };
  if (['on', 'enable', 'activar'].includes(head)) return { type: 'enable' };
  if (['off', 'disable', 'desactivar'].includes(head)) return { type: 'disable' };
  if (['words', 'palabras', 'keywords'].includes(head)) {
    if (['list', 'lista'].includes(second)) return { type: 'list' };
    if (['add', 'agregar'].includes(second)) return { type: 'add', word: rest };
    if (['remove', 'delete', 'eliminar'].includes(second)) return { type: 'remove', word: rest };
  }
  return { type: 'help' };
}

async function getKeywordRule(guild) {
  const rules = await guild.autoModerationRules.fetch();
  return rules.find((rule) => rule.name === RULE_NAME) || null;
}

function getRuleWords(rule) {
  return Array.isArray(rule?.triggerMetadata?.keywordFilter)
    ? rule.triggerMetadata.keywordFilter.map(normalizeWord).filter(Boolean)
    : [];
}

async function ensureRuleWithWord(guild, word, locale) {
  const safeWord = normalizeWord(word);
  if (!safeWord) throw new Error('Invalid keyword');

  const existing = await getKeywordRule(guild);
  if (!existing) {
    const rule = await guild.autoModerationRules.create({
      name: RULE_NAME,
      eventType: AutoModerationRuleEventType.MessageSend,
      triggerType: AutoModerationRuleTriggerType.Keyword,
      triggerMetadata: { keywordFilter: [safeWord] },
      actions: [
        {
          type: AutoModerationActionType.BlockMessage,
          metadata: {
            customMessage: locale === 'en'
              ? 'Your message was blocked by server AutoMod.'
              : 'Tu mensaje fue bloqueado por el AutoMod del servidor.'
          }
        }
      ],
      enabled: true,
      reason: 'HackLabH AutoMod setup'
    });
    return { rule, created: true, words: [safeWord] };
  }

  const words = getRuleWords(existing);
  if (words.includes(safeWord)) {
    return { rule: existing, created: false, exists: true, words };
  }

  const next = [...words, safeWord].slice(0, KEYWORD_LIMIT);
  const updated = await existing.edit({
    triggerMetadata: { keywordFilter: next },
    enabled: true,
    reason: 'HackLabH AutoMod add keyword'
  });
  return { rule: updated, created: false, words: next };
}

async function removeRuleWord(guild, word) {
  const safeWord = normalizeWord(word);
  const rule = await getKeywordRule(guild);
  if (!rule) return { missingRule: true };

  const words = getRuleWords(rule);
  if (!words.includes(safeWord)) {
    return { missingWord: true, words };
  }
  const next = words.filter((item) => item !== safeWord);
  const updated = await rule.edit({
    triggerMetadata: { keywordFilter: next },
    reason: 'HackLabH AutoMod remove keyword'
  });
  return { rule: updated, words: next };
}

async function setRuleEnabled(guild, enabled) {
  const rule = await getKeywordRule(guild);
  if (!rule) return null;
  return rule.edit({ enabled: Boolean(enabled), reason: 'HackLabH AutoMod toggle' });
}

function hasInteractionManagePermission(interaction) {
  return interaction?.memberPermissions?.has?.(PermissionsBitField.Flags.ManageGuild);
}

async function runAction(guild, locale, action) {
  if (action.type === 'status') {
    const rule = await getKeywordRule(guild);
    if (!rule) return t(locale, 'automod_status_none');
    const words = getRuleWords(rule);
    return t(locale, 'automod_status', {
      enabled: rule.enabled ? t(locale, 'automod_enabled') : t(locale, 'automod_disabled'),
      count: words.length
    });
  }

  if (action.type === 'enable') {
    const updated = await setRuleEnabled(guild, true);
    return updated ? t(locale, 'automod_enabled_ok') : t(locale, 'automod_need_rule');
  }

  if (action.type === 'disable') {
    const updated = await setRuleEnabled(guild, false);
    return updated ? t(locale, 'automod_disabled_ok') : t(locale, 'automod_need_rule');
  }

  if (action.type === 'list') {
    const rule = await getKeywordRule(guild);
    if (!rule) return t(locale, 'automod_status_none');

    const words = getRuleWords(rule);
    if (!words.length) return t(locale, 'automod_words_empty');

    return t(locale, 'automod_words_list', {
      count: words.length,
      words: words.map((word) => `• ${word}`).join('\n')
    });
  }

  if (action.type === 'add') {
    const word = normalizeWord(action.word);
    if (!word) return t(locale, 'automod_usage');

    const result = await ensureRuleWithWord(guild, word, locale);
    if (result.exists) return t(locale, 'automod_word_exists');
    if (result.created) return t(locale, 'automod_rule_created', { word });
    return t(locale, 'automod_word_added', { word });
  }

  if (action.type === 'remove') {
    const word = normalizeWord(action.word);
    if (!word) return t(locale, 'automod_usage');

    const result = await removeRuleWord(guild, word);
    if (result.missingRule) return t(locale, 'automod_need_rule');
    if (result.missingWord) return t(locale, 'automod_word_missing');
    return t(locale, 'automod_word_removed', { word });
  }

  return t(locale, 'automod_usage');
}

async function handleAutomodCommand(message) {
  const content = String(message.content || '');
  if (!content.match(/^(!|\.)(automod|modauto)\b/i)) {
    return false;
  }

  const locale = resolveGuildLocale(message.guild);
  if (!hasManageGuildPermission(message.member)) {
    await message.reply(t(locale, 'automod_no_permission'));
    return true;
  }
  if (!hasBotManageGuildPermission(message.guild)) {
    await message.reply(t(locale, 'automod_bot_no_permission'));
    return true;
  }

  const raw = content
    .replace(/^(!|\.)(automod|modauto)\s*/i, '')
    .trim();

  const action = parseAutomodAction(raw);
  const response = await runAction(message.guild, locale, action);
  await message.reply(response);
  return true;
}

async function handleAutomodSlashCommand(interaction) {
  const locale = resolveInteractionLocale(interaction);

  if (!hasInteractionManagePermission(interaction)) {
    await interaction.reply({ content: t(locale, 'automod_no_permission'), ephemeral: true });
    return true;
  }
  if (!hasBotManageGuildPermission(interaction.guild)) {
    await interaction.reply({ content: t(locale, 'automod_bot_no_permission'), ephemeral: true });
    return true;
  }

  const command = interaction.commandName;
  const map = {
    automod_status: { type: 'status' },
    automod_enable: { type: 'enable' },
    automod_disable: { type: 'disable' },
    automod_word_list: { type: 'list' },
    automod_word_add: { type: 'add', word: interaction.options.getString('word', true) },
    automod_word_remove: { type: 'remove', word: interaction.options.getString('word', true) }
  };

  const action = map[command];
  if (!action) return false;

  const response = await runAction(interaction.guild, locale, action);
  await interaction.reply({ content: response, ephemeral: true });
  return true;
}

module.exports = {
  RULE_NAME,
  parseAutomodAction,
  handleAutomodCommand,
  handleAutomodSlashCommand,
  getKeywordRule,
  getRuleWords,
  ensureRuleWithWord,
  removeRuleWord,
  setRuleEnabled,
  hasManageGuildPermission,
  hasBotManageGuildPermission,
  hasInteractionManagePermission,
  runAction
};
