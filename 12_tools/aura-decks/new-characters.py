"""2026-11-09 새 캐릭터 48장을 character-expansions.json 끝에 붙인다. 이미 있으면 덮어쓴다(다시 실행해도 안전).
오라는 캐릭터 능력에 맞춰 골랐고, 하수인이 적던 나무·금속·물에 많이 넣었다. 효과는 기존 카드에서 쓰던 효과와 수치만 쓴다."""
import json, os, sys
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
PATH = os.path.join(ROOT, '03_card-data/sets/character-expansions.json')
E = {  # 기존 카드에서 그대로 가져온 효과 틀
  'draw':        lambda n: {'effectId': 'draw', 'trigger': 'on_summon', 'target': 'self', 'amount': n, 'duration': 'instant'},
  'arrow':       lambda n: {'effectId': 'arcane_arrow', 'trigger': 'on_summon', 'target': 'enemy_hero', 'amount': n, 'duration': 'instant'},
  'heal':        lambda n: {'effectId': 'heal_bless', 'trigger': 'on_summon', 'target': 'weakest_ally', 'amount': n, 'duration': 'instant'},
  'mass_heal':   lambda n: {'effectId': 'mass_heal', 'trigger': 'on_summon', 'target': 'all_allies', 'amount': n, 'duration': 'instant'},
  'wolf':        lambda n: {'effectId': 'summon_wolf', 'trigger': 'on_summon', 'target': 'ally_field', 'amount': n, 'duration': 'match'},
  'splash':      lambda n: {'effectId': 'hero_splash', 'trigger': 'on_attack', 'target': 'enemy_hero', 'amount': n, 'duration': 'instant'},
  'lone':        lambda n: {'effectId': 'lone_wolf', 'trigger': 'passive', 'target': 'self', 'amount': n, 'duration': 'match'},
  'fury':        lambda n: {'effectId': 'swarm_fury', 'trigger': 'passive', 'target': 'self', 'amount': n, 'duration': 'match'},
  'bulwark':     lambda n: {'effectId': 'swarm_bulwark', 'trigger': 'passive', 'target': 'self', 'amount': n, 'duration': 'match'},
  'weaken':      lambda n: {'effectId': 'weaken_all', 'trigger': 'on_summon', 'target': 'all_enemies', 'amount': n, 'duration': 'match'},
  'burn':        lambda n: {'effectId': 'burn', 'trigger': 'on_attack', 'target': 'enemy', 'amount': n, 'duration': 'instant'},
  'mark':        lambda n: {'effectId': 'explosive_mark', 'trigger': 'on_attack', 'target': 'enemy', 'amount': n, 'duration': 'match'},
  'pierce':      lambda n: {'effectId': 'piercing_shot', 'trigger': 'on_attack', 'target': 'enemy_line', 'amount': n, 'duration': 'instant'},
  'armor':       lambda n: {'effectId': 'armor_pierce', 'trigger': 'on_attack', 'target': 'enemy', 'amount': n, 'duration': 'match'},
  'sword':       lambda n: {'effectId': 'sword_aura', 'trigger': 'on_summon', 'target': 'leftmost_enemy', 'amount': n, 'duration': 'instant'},
  'freeze':      lambda n: {'effectId': 'freeze_strongest', 'trigger': 'on_summon', 'target': 'strongest_enemy', 'amount': n, 'duration': 'round'},
  'enhance':     lambda n: {'effectId': 'battle_enhance', 'trigger': 'on_summon', 'target': 'all_allies', 'amount': n, 'duration': 'match'},
  'shield':      lambda n: {'effectId': 'blink_shield', 'trigger': 'on_summon', 'target': 'self', 'amount': n, 'duration': 'instant'},
}
# (cardId, 표시 이름, 오라, 희귀도, 비용, 공격, 체력, 효과, 수치, 그림)
CARDS = [
  # 나무 14
  ('baekyeon.lee-gaeun',   '엘프 이가은',        'wood', 'common', 2, 2, 3, 'heal', 2,   'baekyeon/char-ca'),
  ('astrum.yun-sia',       '궁수 윤시아',        'wood', 'common', 2, 3, 3, 'splash', 1, 'astrum/char-h'),
  ('astrum.lee-sieun',     '재생 헌터 이시은',   'wood', 'common', 2, 3, 4, None, 0,     'astrum/char-a'),
  ('baekyeon.choi-jian',   '방출계 최지안',      'wood', 'common', 3, 4, 4, 'arrow', 2,  'baekyeon/char-cc'),
  ('baekyeon.mun-hayeon',  '칼렌 문하연',        'wood', 'common', 3, 3, 5, 'wolf', 1,   'baekyeon/char-ec'),
  ('astrum.han-yerin',     '식물술사 한예린',    'wood', 'common', 3, 3, 5, 'draw', 1,   'astrum/char-c'),
  ('inquisition.maren',    '약초사 마렌',        'wood', 'common', 3, 2, 5, 'mass_heal', 2, 'inquisition/char-1'),
  ('baekyeon.kang-seoyul', '늑대 수인 강서율',   'wood', 'common', 4, 5, 5, 'lone', 3,   'baekyeon/char-bc'),
  ('gadam.baek-yunseul',   '백산가 백윤슬',      'wood', 'common', 4, 4, 6, 'mass_heal', 2, 'gadam/char-k'),
  ('gadam.baek-sejin',     '전략실장 백세진',    'wood', 'common', 4, 4, 6, 'draw', 1,   'gadam/char-j'),
  ('gadam.baek-doyeon',    '바이오 사장 백도연', 'wood', 'rare',   5, 5, 7, 'wolf', 1,   'gadam/char-i'),
  ('astrum.chae-yuna',     '바람술사 채윤아',    'wood', 'rare',   5, 6, 5, 'pierce', 2, 'astrum/char-e'),
  ('baekyeon.song-chaeyoung','의료 교수 송채영', 'wood', 'rare',   5, 4, 8, 'mass_heal', 2, 'baekyeon/char-fb'),
  ('gadam.baek-jeonghwa',  '백산 회장 백정화',   'wood', 'rare',   6, 6, 8, 'enhance', 1, 'gadam/char-h'),
  # 물 11
  ('baekyeon.han-seorin',  '간섭계 한서린',      'water', 'common', 2, 2, 3, 'draw', 1,  'baekyeon/char-aa'),
  ('gadam.seo-eunchae',    '해륜가 서은채',      'water', 'common', 2, 3, 3, 'splash', 1, 'gadam/char-g'),
  ('baekyeon.baek-jisu',   '엘프 백지수',        'water', 'common', 3, 3, 5, 'arrow', 2, 'baekyeon/char-cb'),
  ('baekyeon.shin-sia',    '변칙계 신시아',      'water', 'common', 3, 4, 5, None, 0,    'baekyeon/char-eb'),
  ('baekyeon.cha-yuhyeon', '뱀파이어 차유현',    'water', 'common', 4, 4, 6, 'bulwark', 1, 'baekyeon/char-da'),
  ('gadam.seo-rakyeong',   '중공업 상무 서라경', 'water', 'common', 4, 5, 5, 'arrow', 2, 'gadam/char-f'),
  ('gadam.seo-yugyeong',   '호텔 대표 서유경',   'water', 'common', 4, 4, 6, 'mass_heal', 2, 'gadam/char-e'),
  ('gadam.seo-jian',       '해륜 부회장 서지안', 'water', 'rare',   5, 5, 7, 'draw', 2,  'gadam/char-d'),
  ('astrum.ma-yuri',       '물술사 마유리',      'water', 'rare',   5, 4, 6, 'freeze', 2, 'astrum/char-d'),
  ('astrum.baek-eunbi',    '빙결술사 백은비',    'water', 'rare',   6, 6, 6, 'freeze', 2, 'astrum/char-j'),
  ('baekyeon.seol-yuran',  '결학 교수 설유란',   'water', 'rare',   6, 5, 7, 'weaken', 1, 'baekyeon/char-fc'),
  # 금속 12
  ('baekyeon.jeong-sieun', '고양이 수인 정시은', 'metal', 'common', 2, 3, 4, 'fury', 3,  'baekyeon/char-bb'),
  ('baekyeon.park-sea',    '뱀파이어 박세아',    'metal', 'common', 3, 3, 5, 'arrow', 2, 'baekyeon/char-db'),
  ('baekyeon.oh-eunsol',   '칼렌 오은솔',        'metal', 'common', 3, 4, 5, None, 0,    'baekyeon/char-ea'),
  ('astrum.mun-sora',      '음파술사 문소라',    'metal', 'common', 3, 2, 4, 'weaken', 1, 'astrum/char-b'),
  ('gadam.oh-yuran',       '백화점 대표 오유란', 'metal', 'common', 4, 5, 5, None, 0,    'gadam/char-c'),
  ('gadam.oh-seogyeong',   '운성 부회장 오서경', 'metal', 'common', 4, 4, 6, 'draw', 1,  'gadam/char-b'),
  ('inquisition.cassandra','감시관 카산드라',    'metal', 'common', 4, 6, 4, 'lone', 3,  'inquisition/char-3'),
  ('astrum.seo-doa',       '염동술사 서도아',    'metal', 'rare',   5, 5, 5, 'sword', 3, 'astrum/char-g'),
  ('baekyeon.ryu-haewon',  '교수 류해원',        'metal', 'rare',   5, 5, 7, 'armor', 1, 'baekyeon/char-fa'),
  ('astrum.cha-seoyul',    '낙뢰술사 차서율',    'metal', 'rare',   6, 7, 6, 'pierce', 2, 'astrum/char-i'),
  ('baekyeon.go-segyeong', '뱀파이어 교수 고세경','metal', 'rare',  6, 6, 7, 'armor', 2, 'baekyeon/char-fd'),
  ('gadam.oh-hyegyeong',   '운성 회장 오혜경',   'metal', 'rare',   6, 6, 8, 'weaken', 1, 'gadam/char-a'),
  # 불 9
  ('baekyeon.seo-nayun',   '여우 수인 서나윤',   'fire', 'common', 2, 3, 3, 'burn', 1,   'baekyeon/char-ba'),
  ('gadam.min-gahyeon',    '세광가 민가현',      'fire', 'common', 2, 2, 4, 'draw', 1,   'gadam/char-n'),
  ('baekyeon.yun-dabin',   '방출계 윤다빈',      'fire', 'common', 3, 4, 4, 'arrow', 2,  'baekyeon/char-ac'),
  ('baekyeon.kwon-nari',   '뱀파이어 권나리',    'fire', 'common', 3, 5, 4, None, 0,     'baekyeon/char-dc'),
  ('astrum.kang-hajin',    '강화술사 강하진',    'fire', 'common', 4, 5, 6, None, 0,     'astrum/char-f'),
  ('gadam.min-seoa',       '세광 본부장 민서아', 'fire', 'common', 4, 4, 6, 'draw', 1,   'gadam/char-m'),
  ('inquisition.eloise',   '백작 영애 엘로이즈', 'fire', 'rare',   5, 6, 6, 'mark', 3,   'inquisition/char-4'),
  ('gadam.min-jihyeon',    '미디어 대표 민지현', 'fire', 'rare',   5, 5, 7, 'enhance', 1, 'gadam/char-l'),
  ('baekyeon.hwang-juha',  '전투 교수 황주하',   'fire', 'rare',   6, 7, 7, 'sword', 3,  'baekyeon/char-fe'),
  # 대지 2
  ('baekyeon.kim-hajin',   '강화계 김하진',      'earth', 'common', 2, 3, 3, 'splash', 1, 'baekyeon/char-ab'),
  ('inquisition.aurelia',  '전 성녀 아우렐리아', 'earth', 'rare',   5, 5, 7, 'shield', 1, 'inquisition/char-2'),
]
def card(row):
    cid, name, aura, rarity, cost, atk, hp, eff, amt, art = row
    return {
      'schemaVersion': 1, 'cardId': cid, 'nameKey': 'card.' + cid.replace('.', '_').replace('-', '_'),
      'displayName': name, 'cardType': 'champion', 'cost': cost, 'aura': aura, 'rarity': rarity,
      'stats': {'attack': atk, 'health': hp}, 'effects': [E[eff](amt)] if eff else [],
      'assetId': 'characters/%s.webp' % art, 'deckLimit': 3 if rarity == 'common' else 2,
      'acquisition': {'sources': ['summon'], 'characterId': cid.replace('.', '-')},
    }
if __name__ == '__main__':
    data = json.load(open(PATH))
    new = [card(r) for r in CARDS]
    ids = {c['cardId'] for c in new}
    assert len(ids) == len(new) == 48, len(new)
    for c in new: assert os.path.exists(os.path.join(ROOT, 'dist/assets', c['assetId'])), c['assetId']
    data['cards'] = [c for c in data['cards'] if c['cardId'] not in ids] + new
    tmp = PATH + '.tmp'
    open(tmp, 'w').write(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    os.replace(tmp, PATH)
    print('added', len(new))
