<template>
  <div v-if="snapshot" class="exp-shell">
    <div class="exp-head">
      <span class="exp-stat"><small>信件</small><b class="exp-hearts">{{ snapshot.hearts }}</b></span>
      <span class="exp-stat"><small>干粮</small><b>{{ snapshot.supplies }}</b></span>
      <span class="exp-stat"><small>背囊</small><b>{{ snapshot.deckCount }} 张</b></span>
      <span class="exp-stat exp-loot"><small>路上的邮袋</small><b>+{{ snapshot.lootStamps }} 邮票 · +{{ snapshot.lootInk }} 墨点</b></span>
    </div>
    <div class="exp-progress" :aria-label="`第 ${snapshot.stage} 段，共 6 段`">
      <span
        v-for="pip in snapshot.pips"
        :key="pip.stage"
        class="exp-pip"
        :class="pip.className"
        aria-hidden="true"
      >{{ pip.stage }}</span>
    </div>

    <div class="exp-stage">
      <template v-if="snapshot.result">
        <div class="exp-result" :class="snapshot.result.success ? 'is-win' : 'is-lose'">
          <span class="exp-tag">{{ snapshot.result.tag }}</span>
          <h4>{{ snapshot.result.title }}</h4>
          <p>{{ snapshot.result.rewardText }}</p>
          <p>{{ snapshot.result.summary }}</p>
          <p v-if="snapshot.result.unlockedText" class="exp-unlock">{{ snapshot.result.unlockedText }}</p>
          <p class="exp-meta">{{ snapshot.result.metaText }}</p>
          <div v-if="snapshot.result.rewards.length && !snapshot.result.picked" class="exp-rewards">
            <p class="exp-lead">选一样带回邮局</p>
            <div class="exp-choices">
              <button
                v-for="(reward, index) in snapshot.result.rewards"
                :key="index"
                class="exp-choice exp-reward"
                type="button"
                @click="handlers.onClaimReward(index)"
              >
                <b>{{ reward.name }}</b>
                <span>{{ reward.desc }}</span>
              </button>
            </div>
          </div>
          <p v-if="snapshot.result.picked" class="exp-reward-picked">已收下「{{ snapshot.result.rewardName }}」。</p>
          <p v-if="snapshot.result.rewards.length && !snapshot.result.picked" class="exp-hint">
            先选一样，再决定下一趟。
          </p>
          <div v-else class="exp-result-actions">
            <button class="exp-primary" type="button" @click="handlers.onRestart">再来一趟</button>
            <button class="exp-secondary" type="button" @click="handlers.onFinish">回到邮局</button>
          </div>
        </div>
      </template>

      <template v-else-if="snapshot.cardChoice">
        <div class="exp-encounter">
          <span class="exp-tag">{{ snapshot.cardChoice.tag }}</span>
          <h4>{{ snapshot.cardChoice.title }}</h4>
          <p>{{ snapshot.cardChoice.desc }}</p>
          <div class="exp-hand exp-card-choice">
            <button
              v-for="(card, index) in snapshot.cardChoice.cards"
              :key="index"
              class="exp-card"
              type="button"
              @click="handlers.onPickCard(index)"
            >
              <span class="exp-card-name">{{ card.name }}</span>
              <small>{{ card.desc }}</small>
              <b>+{{ card.power }}</b>
            </button>
          </div>
          <p class="exp-hint">{{ snapshot.cardChoice.hint }}</p>
        </div>
      </template>

      <template v-else-if="!snapshot.current">
        <p class="exp-lead">第 {{ snapshot.stage }} 段 · 选一条路</p>
        <div class="exp-options">
          <button
            v-for="(option, index) in snapshot.options"
            :key="index"
            class="exp-option"
            type="button"
            @click="handlers.onOption(index)"
          >
            <span class="exp-tag">{{ option.tag }}</span>
            <b>{{ option.title }}</b>
            <p>{{ option.desc }}</p>
            <small>{{ option.note }}</small>
          </button>
        </div>
      </template>

      <template v-else-if="snapshot.current.kind === 'camp'">
        <div class="exp-encounter">
          <span class="exp-tag">营地</span>
          <h4>路边营地</h4>
          <p>火升起来了。你可以在天亮前做一件事。</p>
          <div class="exp-choices">
            <button class="exp-choice" type="button" :disabled="snapshot.camp.healDisabled" @click="handlers.onCamp('heal')">
              <b>补 1 封信</b><span>信件 {{ snapshot.camp.letters }} / {{ snapshot.camp.maxLetters }}{{ snapshot.camp.healDisabled ? " · 已经满了" : "" }}</span>
            </button>
            <button class="exp-choice" type="button" :disabled="snapshot.camp.supplyDisabled" @click="handlers.onCamp('supply')">
              <b>补 2 份干粮</b><span>干粮 {{ snapshot.camp.supplies }}{{ snapshot.camp.supplyDisabled ? " · 背不动了" : "" }}</span>
            </button>
            <button class="exp-choice" type="button" @click="handlers.onCamp('card')">
              <b>往背囊里塞 1 张牌</b><span>从三张里挑一张</span>
            </button>
          </div>
        </div>
      </template>

      <template v-else-if="snapshot.current.kind === 'trade'">
        <div class="exp-encounter">
          <span class="exp-tag">集市</span>
          <h4>湖边集市</h4>
          <p>货郎把布摊开：“只换不卖。换完你就得赶路了。”</p>
          <div class="exp-choices">
            <button class="exp-choice" type="button" :disabled="snapshot.trade.supplyDisabled" @click="handlers.onTrade('supply')">
              <b>80 邮票 → 2 份干粮</b><span>{{ snapshot.trade.supplyDisabled ? "邮票不够" : `干粮 ${snapshot.trade.supplies} / 9` }}</span>
            </button>
            <button class="exp-choice" type="button" :disabled="snapshot.trade.cardDisabled" @click="handlers.onTrade('card')">
              <b>20 墨点 → 三选一</b><span>{{ snapshot.trade.cardDisabled ? "墨点不够" : `现有 ${snapshot.trade.ink} 墨点` }}</span>
            </button>
            <button class="exp-choice" type="button" @click="handlers.onTrade('leave')">
              <b>不换了</b><span>继续赶路</span>
            </button>
          </div>
        </div>
      </template>

      <template v-else-if="snapshot.current.kind === 'event'">
        <div class="exp-encounter">
          <span class="exp-tag">路遇</span>
          <h4>{{ snapshot.event.title }}</h4>
          <p>{{ snapshot.event.text }}</p>
          <div class="exp-choices">
            <button
              v-for="(choice, index) in snapshot.event.choices"
              :key="index"
              class="exp-choice"
              type="button"
              :disabled="choice.disabled"
              @click="handlers.onEvent(index)"
            >
              <b>{{ choice.label }}</b>
              <span>{{ choice.note }}</span>
            </button>
          </div>
        </div>
      </template>

      <template v-else>
        <div class="exp-encounter">
          <span class="exp-tag">{{ snapshot.current.tag }} · 需要 {{ snapshot.current.need }}</span>
          <h4>{{ snapshot.current.title }}</h4>
          <p>{{ snapshot.current.desc }}</p>
          <div v-if="snapshot.hand.length" class="exp-hand">
            <button
              v-for="card in snapshot.hand"
              :key="card.index"
              class="exp-card"
              :class="{ 'is-selected': card.selected, 'is-match': card.match }"
              type="button"
              :disabled="card.disabled"
              @click="handlers.onCard(card.index)"
            >
              <span class="exp-card-name">{{ card.name }}</span>
              <small>{{ card.desc }}</small>
              <b>+{{ card.power }}</b>
            </button>
          </div>
          <p v-else class="exp-empty">背囊空了，只能硬着头皮往前走。</p>
          <div class="exp-total">
            <template v-if="snapshot.hasDetour">绕路：跳过这处路障，耗 1 份干粮</template>
            <template v-else>
              已选 {{ snapshot.selectedCount }} / 2 · 通行 <b>{{ snapshot.selectedPower }}</b> / {{ snapshot.current.need }}<template v-if="snapshot.hasShield"> · 护信生效</template>
            </template>
          </div>
          <button
            v-if="snapshot.hand.length"
            class="exp-primary"
            type="button"
            :disabled="!snapshot.canResolve"
            @click="handlers.onResolve"
          >{{ snapshot.hasDetour ? "绕路前进" : "投递这封信" }}</button>
          <template v-if="snapshot.hand.length">
            <p class="exp-hint">同类牌有额外加成；“护信”失败时保住一封信；“绕路”直接跳过路障，但耗 1 份干粮。</p>
          </template>
          <template v-else>
            <button class="exp-primary exp-danger" type="button" @click="handlers.onResolve">硬着头皮走</button>
          </template>
        </div>
      </template>
    </div>

    <div class="exp-log">
      <span>手记</span>
      <ul>
        <li v-for="(line, index) in snapshot.log" :key="index">{{ line }}</li>
        <li v-if="!snapshot.log.length">路还很长。</li>
      </ul>
    </div>
    <div class="exp-foot">
      <button class="link-btn" type="button" @click="handlers.onClose">收起</button>
      <button v-if="!snapshot.result" class="link-btn exp-warn" type="button" @click="handlers.onAbandon">放弃这趟</button>
    </div>
    <div v-if="snapshot.confirmAbandon" class="exp-confirm">
      <p>放弃这趟会把邮袋留在路上，什么也带不回来。确定吗？</p>
      <div>
        <button class="link-btn exp-warn" type="button" @click="handlers.onAbandonConfirm">确认放弃</button>
        <button class="link-btn" type="button" @click="handlers.onAbandonCancel">再想想</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { expeditionStore } from "./expeditionStore.js";

defineProps({
  handlers: { type: Object, required: true }
});
const snapshot = computed(() => expeditionStore.snapshot);
</script>
