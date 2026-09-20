// ============ 泰拉物语 · 全局配置与数据表 ============
'use strict';
window.G = {};

const CFG = {
  W: 1200, H: 400,            // 世界尺寸 (tiles)
  TILE: 32,                   // 渲染逻辑像素
  DAY_LEN: 380, NIGHT_LEN: 240, // 秒
  GRAV: 42, MAX_FALL: 62, JUMP_V: 16.6,
  MOVE: 10.2, MOVE_ACC: 70, FRICTION: 55, AIR_ACC: 34,
  MAX_HP: 400, START_HP: 100,
  REGEN_DELAY: 8,             // 脱战后回血延迟(秒)
  AUTOSAVE: 45,               // 自动保存间隔(秒)
};

// ---------- 方块定义 ----------
// solid:碰撞  hp:耐久  tool:'pick'|'axe'|'any'  lvl:所需镐等级  drop:掉落物品id(可为函数)
// light:发光  plat:平台  dmg:接触伤害
const T = {
  AIR:0, DIRT:1, GRASS:2, STONE:3, TREE:4, LEAF:5, WOOD:6, WORKBENCH:7, FURNACE:8, ANVIL:9,
  TORCH:10, COPPER:11, IRON:12, SILVER:13, GOLD:14, SAND:15, SNOW:16, ICE:17, CACTUS:18,
  PLAT:19, DOOR_C:20, DOOR_O:21, GLASS:22, GEM:23, ASH:24, HELLSTONE:25, LAVA:26, CHEST:27,
  CRYSTAL:28, MUSH:29, FLOWER:30, TGRASS:31, BEDROCK:32, PINE:33, PINELEAF:34,
};

const TILES = [];
function defTile(id, d){ TILES[id] = Object.assign({solid:true, hp:30, tool:'pick', lvl:0, drop:null, light:0}, d); }
defTile(T.AIR,      {solid:false, name:''});
defTile(T.DIRT,     {name:'泥土', hp:24, drop:'dirt'});
defTile(T.GRASS,    {name:'草地', hp:24, drop:'dirt'});
defTile(T.STONE,    {name:'石头', hp:46, drop:'stone'});
defTile(T.TREE,     {name:'树干', solid:false, hp:30, tool:'axe', drop:'wood'});
defTile(T.LEAF,     {name:'树叶', solid:false, hp:4, tool:'any', drop:null});
defTile(T.WOOD,     {name:'木材', hp:22, drop:'wood'});
defTile(T.WORKBENCH,{name:'工作台', hp:16, drop:'workbench'});
defTile(T.FURNACE,  {name:'熔炉', hp:22, drop:'furnace', light:6});
defTile(T.ANVIL,    {name:'铁砧', hp:22, drop:'anvil'});
defTile(T.TORCH,    {name:'火把', solid:false, hp:2, tool:'any', drop:'torch', light:15});
defTile(T.COPPER,   {name:'铜矿', hp:58, lvl:1, drop:'copper_ore'});
defTile(T.IRON,     {name:'铁矿', hp:74, lvl:1, drop:'iron_ore'});
defTile(T.SILVER,   {name:'银矿', hp:90, lvl:2, drop:'silver_ore'});
defTile(T.GOLD,     {name:'金矿', hp:108, lvl:2, drop:'gold_ore'});
defTile(T.SAND,     {name:'沙子', hp:18, drop:'sand'});
defTile(T.SNOW,     {name:'雪块', hp:20, drop:'snow'});
defTile(T.ICE,      {name:'冰块', hp:30, drop:'ice'});
defTile(T.CACTUS,   {name:'仙人掌', solid:false, hp:22, tool:'axe', drop:'wood', dmg:8});
defTile(T.PLAT,     {name:'木平台', solid:false, plat:true, hp:10, tool:'any', drop:'plat'});
defTile(T.DOOR_C,   {name:'木门', hp:20, tool:'any', drop:'door'});
defTile(T.DOOR_O,   {name:'木门', solid:false, hp:20, tool:'any', drop:'door'});
defTile(T.GLASS,    {name:'玻璃', hp:10, drop:'glass'});
defTile(T.GEM,      {name:'宝石矿', hp:126, lvl:2, drop:'gem'});
defTile(T.ASH,      {name:'灰烬块', hp:34, lvl:1, drop:'ash'});
defTile(T.HELLSTONE,{name:'狱岩矿', hp:150, lvl:3, drop:'hellstone'});
defTile(T.LAVA,     {name:'岩浆', solid:false, hp:1e9, tool:'any', drop:null, dmg:35});
defTile(T.CHEST,    {name:'宝箱', hp:26, tool:'any', drop:null, loot:true});
defTile(T.CRYSTAL,  {name:'生命水晶', solid:false, hp:14, tool:'any', drop:'life_crystal', light:5});
defTile(T.MUSH,     {name:'蘑菇', solid:false, hp:1, tool:'any', drop:'mushroom'});
defTile(T.FLOWER,   {name:'野花', solid:false, hp:1, tool:'any', drop:null});
defTile(T.TGRASS,   {name:'草丛', solid:false, hp:1, tool:'any', drop:null});
defTile(T.BEDROCK,  {name:'基岩', hp:1e9, lvl:99, drop:null});
defTile(T.PINE,     {name:'松树', solid:false, hp:30, tool:'axe', drop:'wood'});
defTile(T.PINELEAF, {name:'松针', solid:false, hp:4, tool:'any', drop:null});

// ---------- 背景墙 ----------
const WALL = { NONE:0, DIRT:1, STONE:2, WOOD:3, SNOW:4, SAND:5, ASH:6 };

// ---------- 物品定义 ----------
// type: block/tool/weapon/bow/ammo/consume/material/summon
const ITEMS = {
  dirt:        {name:'泥土块', type:'block', tile:T.DIRT, max:999},
  stone:       {name:'石块', type:'block', tile:T.STONE, max:999},
  wood:        {name:'木材', type:'block', tile:T.WOOD, max:999},
  sand:        {name:'沙子', type:'block', tile:T.SAND, max:999},
  snow:        {name:'雪块', type:'block', tile:T.SNOW, max:999},
  ice:         {name:'冰块', type:'block', tile:T.ICE, max:999},
  glass:       {name:'玻璃', type:'block', tile:T.GLASS, max:999},
  ash:         {name:'灰烬块', type:'block', tile:T.ASH, max:999},
  torch:       {name:'火把', type:'block', tile:T.TORCH, max:999},
  plat:        {name:'木平台', type:'block', tile:T.PLAT, max:999},
  door:        {name:'木门', type:'block', tile:T.DOOR_C, max:999},
  workbench:   {name:'工作台', type:'block', tile:T.WORKBENCH, max:999},
  furnace:     {name:'熔炉', type:'block', tile:T.FURNACE, max:999},
  anvil:       {name:'铁砧', type:'block', tile:T.ANVIL, max:999},

  copper_ore:  {name:'铜矿石', type:'material', max:999},
  iron_ore:    {name:'铁矿石', type:'material', max:999},
  silver_ore:  {name:'银矿石', type:'material', max:999},
  gold_ore:    {name:'金矿石', type:'material', max:999},
  hellstone:   {name:'狱岩石', type:'material', max:999},
  gem:         {name:'宝石', type:'material', max:999},
  copper_bar:  {name:'铜锭', type:'material', max:999},
  iron_bar:    {name:'铁锭', type:'material', max:999},
  silver_bar:  {name:'银锭', type:'material', max:999},
  gold_bar:    {name:'金锭', type:'material', max:999},
  hell_bar:    {name:'狱岩锭', type:'material', max:999},
  gel:         {name:'凝胶', type:'material', max:999},
  lens:        {name:'晶状体', type:'material', max:999},

  mushroom:    {name:'发光蘑菇', type:'consume', heal:25, max:999},
  life_crystal:{name:'生命水晶', type:'consume', maxHP:20, max:999},
  heart:       {name:'生命之心', type:'heal_drop', heal:30, max:999},

  copper_pick: {name:'铜镐', type:'tool', tool:'pick', power:55, lvl:1, dmg:5, max:1},
  iron_pick:   {name:'铁镐', type:'tool', tool:'pick', power:82, lvl:2, dmg:6, max:1},
  silver_pick: {name:'银镐', type:'tool', tool:'pick', power:105, lvl:3, dmg:7, max:1},
  gold_pick:   {name:'金镐', type:'tool', tool:'pick', power:130, lvl:3, dmg:8, max:1},
  hell_pick:   {name:'熔岩镐', type:'tool', tool:'pick', power:175, lvl:4, dmg:10, max:1},
  copper_axe:  {name:'铜斧', type:'tool', tool:'axe', power:60, dmg:7, max:1},

  copper_sword:{name:'铜短剑', type:'weapon', dmg:9, range:2.6, arc:2.0, cd:0.32, knock:5.5, max:1},
  iron_sword:  {name:'铁阔剑', type:'weapon', dmg:14, range:3.1, arc:2.4, cd:0.36, knock:6.5, max:1},
  silver_sword:{name:'银阔剑', type:'weapon', dmg:18, range:3.1, arc:2.4, cd:0.34, knock:7, max:1},
  gold_sword:  {name:'金阔剑', type:'weapon', dmg:22, range:3.3, arc:2.6, cd:0.32, knock:8, max:1},
  lava_sword:  {name:'熔岩之刃', type:'weapon', dmg:32, range:3.5, arc:2.8, cd:0.3, knock:9, fire:1, max:1},

  wood_bow:    {name:'木弓', type:'bow', dmg:7, cd:0.42, max:1},
  silver_bow:  {name:'银弓', type:'bow', dmg:13, cd:0.36, max:1},
  gold_bow:    {name:'金弓', type:'bow', dmg:16, cd:0.32, max:1},
  arrow:       {name:'木箭', type:'ammo', dmg:3, max:999},

  slime_crown: {name:'史莱姆王冠', type:'summon', boss:'king', max:20},
  suspicious_eye:{name:'可疑眼球', type:'summon', boss:'eye', max:20},
};

// ---------- 合成表 ----------
// station: hand/workbench/furnace/anvil
const RECIPES = [
  {st:'hand',      out:'workbench', n:1, need:{wood:10}},
  {st:'hand',      out:'torch',     n:4, need:{wood:1, gel:1}},
  {st:'hand',      out:'slime_crown', n:1, need:{gel:20, gold_bar:1, gem:1}},
  {st:'hand',      out:'suspicious_eye', n:1, need:{lens:6}},
  {st:'workbench', out:'furnace',   n:1, need:{stone:20, wood:4, torch:3}},
  {st:'workbench', out:'plat',      n:2, need:{wood:1}},
  {st:'workbench', out:'door',      n:1, need:{wood:6}},
  {st:'workbench', out:'wood_bow',  n:1, need:{wood:10}},
  {st:'workbench', out:'arrow',     n:5, need:{wood:1, stone:1}},
  {st:'furnace',   out:'copper_bar',n:1, need:{copper_ore:3}},
  {st:'furnace',   out:'iron_bar',  n:1, need:{iron_ore:3}},
  {st:'furnace',   out:'silver_bar',n:1, need:{silver_ore:4}},
  {st:'furnace',   out:'gold_bar',  n:1, need:{gold_ore:4}},
  {st:'furnace',   out:'hell_bar',  n:1, need:{hellstone:3}},
  {st:'furnace',   out:'glass',     n:1, need:{sand:2}},
  {st:'workbench', out:'anvil',     n:1, need:{iron_bar:5}},   // 铁砧在工作台上制作（泰拉瑞亚规则）
  {st:'anvil',     out:'iron_pick', n:1, need:{iron_bar:5, wood:3}},
  {st:'anvil',     out:'iron_sword',n:1, need:{iron_bar:6, wood:2}},
  {st:'anvil',     out:'silver_pick',n:1, need:{silver_bar:5, wood:3}},
  {st:'anvil',     out:'silver_sword',n:1, need:{silver_bar:6, wood:2}},
  {st:'anvil',     out:'silver_bow',n:1, need:{silver_bar:5, wood:5}},
  {st:'anvil',     out:'gold_pick', n:1, need:{gold_bar:5, wood:3}},
  {st:'anvil',     out:'gold_sword',n:1, need:{gold_bar:6, wood:2}},
  {st:'anvil',     out:'gold_bow',  n:1, need:{gold_bar:5, wood:5}},
  {st:'anvil',     out:'hell_pick', n:1, need:{hell_bar:5, wood:3}},
  {st:'anvil',     out:'lava_sword',n:1, need:{hell_bar:6, wood:2}},
];

// ---------- 敌人定义 ----------
// ai: hop/walk/fly/eye/imp/bossEye/bossKing
const ENEMIES = {
  green_slime:{name:'绿史莱姆', hp:14, dmg:6, def:0, w:1.5, h:1.1, ai:'hop', color:'#5ec44a',
               drops:[['gel',1,2,1]], night:false},
  blue_slime: {name:'蓝史莱姆', hp:28, dmg:10, def:2, w:1.7, h:1.25, ai:'hop', color:'#4a8fd9',
               drops:[['gel',1,3,1]], night:false},
  zombie:     {name:'僵尸', hp:45, dmg:14, def:4, w:1.4, h:2.6, ai:'walk', speed:3.2,
               drops:[['wood',1,3,.4],['torch',1,4,.25]], night:true},
  demon_eye:  {name:'恶魔之眼', hp:38, dmg:15, def:2, w:1.4, h:1.4, ai:'eye', speed:6.5,
               drops:[['lens',1,1,.33]], night:true, fly:true},
  cave_bat:   {name:'洞穴蝙蝠', hp:22, dmg:12, def:0, w:1.1, h:0.9, ai:'fly', speed:5.5,
               drops:[], fly:true, cave:true},
  skeleton:   {name:'骷髅', hp:60, dmg:18, def:6, w:1.4, h:2.5, ai:'walk', speed:3.8,
               drops:[['arrow',4,9,.35],['iron_ore',1,3,.25]], cave:true},
  fire_imp:   {name:'火焰小鬼', hp:70, dmg:22, def:8, w:1.5, h:2.2, ai:'imp', speed:4,
               drops:[['hellstone',1,2,.3]], fly:true, hell:true},
};

// ---------- Boss ----------
const BOSSES = {
  eye: {name:'克苏鲁之眼', hp:1500, dmg:14, dmg2:22, def:10, w:3.6, h:3.6, ai:'bossEye',
        drops:[['gold_bar',4,6,1],['gem',1,3,1],['lens',2,4,1],['life_crystal',1,1,1],['heart',0,0,1]]},
  king:{name:'史莱姆王', hp:950, dmg:11, def:4, w:3.4, h:2.8, ai:'bossKing',
        drops:[['gel',25,40,1],['gold_bar',1,2,1],['gem',1,2,1],['life_crystal',1,1,.5],['heart',0,0,1]]},
};

// ---------- 冒险目标 ----------
const OBJECTIVES = [
  {id:'wood',   text:'砍树收集 10 木材',        check:s=>s.countItem('wood')>=10},
  {id:'wb',     text:'制作并放置工作台',        check:s=>s.placedOnce.has(T.WORKBENCH)},
  {id:'furn',   text:'挖石 20 块制作熔炉',      check:s=>s.placedOnce.has(T.FURNACE)},
  {id:'bars',   text:'熔炼 5 个铁锭',           check:s=>s.countItem('iron_bar')>=5},
  {id:'anvil',  text:'制作铁砧与铁剑',          check:s=>s.hasItem('iron_sword')||s.hasItem('silver_sword')||s.hasItem('gold_sword')},
  {id:'night',  text:'生存过一个完整的夜晚',    check:s=>s.survivedNight},
  {id:'cry',    text:'使用一颗生命水晶',        check:s=>s.crystalUsed>0},
  {id:'eye',    text:'击败克苏鲁之眼',          check:s=>s.eyeSlain},
  {id:'more',   text:'自由冒险：建造属于你的家园', check:s=>false},
];

G.CFG = CFG; G.T = T; G.TILES = TILES; G.WALL = WALL; G.ITEMS = ITEMS;
G.RECIPES = RECIPES; G.ENEMIES = ENEMIES; G.BOSSES = BOSSES; G.OBJECTIVES = OBJECTIVES;
