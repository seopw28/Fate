"""오라 기본 덱 5종(03_card-data/sets/aura-decks.json)을 만든다. 2026-11-09
하수인 30 = 덱 오라 20(10종 x2, 다섯 덱이 같은 비용 틀) + 다른 오라 10(다른 오라 압박 하수인 8 + 상생 오라 3비용 카드 2)
마법 20·함정 10은 다섯 덱 공통. --score 로 덱별 점수만 출력한다."""
import json, os, sys
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
OUT = os.path.join(ROOT, '03_card-data/sets/aura-decks.json')
# 틀: 압박 2종 · 2비용 · 3비용 2종 · 4비용 3종 · 희귀 5비용 · 희귀 6비용 (각 2장)
CORE = {
  'fire':  ['pressure.baek-haryeon', 'pressure.seol-choyeong', 'baekyeon.seo-nayun', 'baekyeon.yun-dabin', 'core.marie-waveblade',
            'archio.rosalind', 'astrum.kang-hajin', 'archio.brida', 'gadam.min-jihyeon', 'baekyeon.hwang-juha'],
  'water': ['pressure.han-sobing', 'pressure.namgung-ahyeon', 'archio.estelle', 'baekyeon.baek-jisu', 'baekyeon.shin-sia',
            'gadam.seo-rakyeong', 'baekyeon.cha-yuhyeon', 'gadam.seo-yugyeong', 'gadam.seo-jian', 'astrum.baek-eunbi'],
  'wood':  ['pressure.cheon-mua', 'pressure.im-cheonga', 'astrum.lee-sieun', 'baekyeon.choi-jian', 'baekyeon.mun-hayeon',
            'baekyeon.kang-seoyul', 'gadam.baek-yunseul', 'gadam.baek-sejin', 'astrum.chae-yuna', 'gadam.baek-jeonghwa'],
  'metal': ['pressure.yu-soha', 'pressure.baekri-on', 'baekyeon.jeong-sieun', 'baekyeon.park-sea', 'baekyeon.oh-eunsol',
            'gadam.oh-yuran', 'archio.noel', 'inquisition.cassandra', 'astrum.seo-doa', 'astrum.cha-seoyul'],
  'earth': ['pressure.yang-sogae', 'baekyeon.kim-hajin', 'junhy.dan-hwa', 'archio.winifred', 'gangho.cho-a',
            'archio.tanya', 'astra.pierre', 'archio.seraphina', 'inquisition.aurelia', 'bellarion.adelin-orwell'],
}
# 오행 상생: 나무→불→대지→금속→물→나무. 내 오라를 낳는 오라의 3비용 첫 카드(CORE[3]) 2장을 빌린다
MOTHER = {'fire': 'wood', 'earth': 'fire', 'metal': 'earth', 'water': 'metal', 'wood': 'water'}
SPELLS = [('reversal.judgment', 1), ('reversal.bulwark', 1), ('reversal.giant-hunt', 1), ('reversal.weight-toll', 1),
          ('reversal.life-siphon', 1), ('reversal.insight', 1), ('core.spring-of-restoration', 2), ('core.crimson-bolt', 2),
          ('tower.arcane-insight', 2), ('storm.tremor', 1), ('arcana.prism-revelation', 1), ('core.frozen-chain', 1),
          ('storm.firestorm', 1), ('volt.chain-lightning', 1), ('storm.tempest', 1), ('arcana.earth-rift', 1), ('tower.mana-overflow', 1)]
TRAPS = [('core.ember-snare', 2), ('core.steel-guard', 2), ('core.ambush-mine', 1), ('core.counter-current', 1),
         ('core.last-stand', 1), ('core.swamp-bind', 1), ('core.rally-cry', 1), ('tower.summon-nullifier', 1)]
NAMES = {'fire': '불의 덱', 'water': '물의 덱', 'wood': '나무의 덱', 'metal': '금속의 덱', 'earth': '대지의 덱'}
ORDER = ['fire', 'water', 'wood', 'metal', 'earth']

def cards():
    out = {}
    for f in ['core-set.json', 'character-expansions.json']:
        for c in json.load(open(os.path.join(ROOT, '03_card-data/sets', f)))['cards']: out[c['cardId']] = c
    return out

def build():
    decks = []
    for aura in ORDER:
        champs = [(cid, 2) for cid in CORE[aura]]
        champs += [(CORE[a][i], 1) for a in ORDER if a != aura for i in (0, 1)]
        champs += [(CORE[MOTHER[aura]][3], 2)]
        decks.append({'deckId': 'aura.' + aura, 'aura': aura, 'name': NAMES[aura],
                      'cards': [{'cardId': c, 'count': n} for c, n in champs + SPELLS + TRAPS]})
    return {'schemaVersion': 1, 'decks': decks}

EFFECT_VALUE = {'draw': 2, 'arcane_arrow': 1, 'heal_bless': .7, 'mass_heal': 2, 'summon_wolf': 3, 'hero_splash': 2, 'lone_wolf': 2,
                'swarm_fury': 2, 'swarm_bulwark': 2, 'weaken_all': 3, 'burn': 1.5, 'explosive_mark': 2, 'piercing_shot': 3,
                'armor_pierce': 2, 'sword_aura': 3, 'freeze_strongest': 3, 'battle_enhance': 4, 'blink_shield': 2,
                'entry_hero_damage': 1, 'time_bomb': 4, 'shock_storage': 2}
def value(c):
    """하수인 1장 점수 = 공격 + 체력 + 효과 값 - (2 x 비용 + 2). 0이면 비용만큼 평균."""
    e = sum(EFFECT_VALUE.get(x['effectId'], 2) * (x['amount'] if x['effectId'] in ('draw', 'arcane_arrow', 'entry_hero_damage', 'mass_heal') else 1) for x in c['effects'])
    return c['stats']['attack'] + c['stats']['health'] + e - (2 * c['cost'] + 2)

if __name__ == '__main__':
    db = cards(); data = build()
    for d in data['decks']:
        champs = [(db[x['cardId']], x['count']) for x in d['cards'] if db[x['cardId']]['cardType'] == 'champion']
        same = sum(n for c, n in champs if c['aura'] == d['aura'])
        total = sum(n for c, n in champs)
        cost = sum(c['cost'] * n for c, n in champs) / total
        score = sum(value(c) * n for c, n in champs if c['aura'] == d['aura'])
        print(d['name'], '하수인', total, '(같은 오라', same, ') 평균 비용 %.2f' % cost, '같은 오라 점수 %.1f' % score,
              '전체', sum(x['count'] for x in d['cards']))
    if '--score' not in sys.argv:
        tmp = OUT + '.tmp'; open(tmp, 'w').write(json.dumps(data, ensure_ascii=False, indent=2) + '\n'); os.replace(tmp, OUT); print('saved', OUT)
