export type ExchangeCode = 'okx' | 'binance';

export type TriggerOperator = 'gte' | 'lte';

export type OrderSide = 'buy' | 'sell';

export type OrderType = 'market' | 'limit';

export type TradeOrderQuantityType = 'base' | 'quote';

export type TriggerStatus = 'pending' | 'confirmed' | 'ignored' | 'failed';

export type SignalStatus = 'pending' | 'converted' | 'rejected' | 'expired';

export type RiskCheckStatus = 'passed' | 'rejected';

export type RiskTradingMode = 'simulation_only' | 'allow_real';

export type RuleRuntimeStatus = 'idle' | 'running' | 'paused' | 'limit_reached' | 'error';

export type TradeAccountType = 'simulation' | 'real';

export type TradeOperationLogLevel = 'info' | 'warning' | 'error';

export type AuditLogLevel = 'info' | 'warning' | 'error';

export type AuditLogAction =
  | 'signal.created'
  | 'signal.ingested'
  | 'signal.converted'
  | 'signal.duplicated'
  | 'risk.passed'
  | 'risk.rejected'
  | 'trigger.created'
  | 'trigger.confirmed'
  | 'trigger.failed'
  | 'trigger.ignored'
  | 'order.submitted'
  | 'order.synced'
  | 'order.final_validation_failed'
  | 'order.failed'
  | 'order.sync_failed'
  | 'recovery.created'
  | 'recovery.retry_started'
  | 'recovery.retry_succeeded'
  | 'recovery.retry_failed'
  | 'recovery.manual_review_required'
  | 'private_stream.error'
  | 'strategy.error';

export type OrderRecoverySource = 'manual' | 'rule' | 'system';

export type OrderRecoveryFailureStage =
  | 'order_submit_finalize'
  | 'rule_trigger_finalize'
  | 'order_sync'
  | 'private_stream'
  | 'trade_fill_sync'
  | 'balance_refresh';

export type SignalSourceType = 'price_rule' | 'external_input';

export type OrderRecoveryStatus =
  | 'pending_recovery'
  | 'recovering'
  | 'recovered'
  | 'manual_review_required'
  | 'recovery_failed';

export type UnifiedOrderStatus =
  | 'submitted'
  | 'partially_filled'
  | 'filled'
  | 'cancelled'
  | 'rejected'
  | 'failed';

export interface MonitorRule {
  /** 瑙勫垯涓婚敭锛屼娇鐢?nanoid 鏂逛究鍓嶅悗绔睍绀?*/
  id: string;
  /** 浜ゆ槗鎵€缂栫爜锛屽綋鍓嶆敮鎸?okx锛宐inance 涓洪鐣?*/
  exchange: ExchangeCode;
  /** 缁熶竴浜ゆ槗瀵癸紝鍓嶇寤鸿浣跨敤 BTC-USDT 杩欑被鍙鏍煎紡 */
  symbol: string;
  /** 瑙﹀彂鏂瑰悜锛実te 琛ㄧず澶т簬绛変簬鐩爣浠凤紝lte 琛ㄧず灏忎簬绛変簬鐩爣浠?*/
  operator: TriggerOperator;
  /** 鐩爣浠锋牸锛屼娇鐢ㄥ瓧绗︿覆閬垮厤娴偣绮惧害闂 */
  targetPrice: string;
  /** 妫€娴嬮鐜囷紝鍗曚綅姣 */
  checkIntervalMs: number;
  /** 涔板叆鎴栧崠鍑烘柟鍚?*/
  side: OrderSide;
  /** 涓嬪崟绫诲瀷锛岀涓€鐗堟敮鎸佸競浠峰拰闄愪环 */
  orderType: OrderType;
  /** 鍩虹甯佹暟閲忥紝渚嬪 BTC 鏁伴噺 */
  baseQuantity?: string;
  /** 璁′环甯侀噾棰濓紝渚嬪 USDT 閲戦 */
  quoteAmount?: string;
  /** 闄愪环鍗曚环鏍硷紝甯備环鍗曞彲涓虹┖ */
  limitPrice?: string;
  /** 鏈€澶ф粦鐐圭櫨鍒嗘瘮锛屼緥濡?0.5 琛ㄧず 0.5% */
  maxSlippagePercent: string;
  /** 瑙﹀彂鍐峰嵈鏃堕棿锛屽崟浣嶆绉?*/
  cooldownMs: number;
  /** 鍗曟潯瑙勫垯鏈€澶цЕ鍙戞鏁?*/
  maxTriggerCount: number;
  /** 宸茶Е鍙戞鏁?*/
  triggeredCount: number;
  /** 鏄惁鍚敤妯℃嫙涓嬪崟锛岀涓€鐗堥粯璁ゅ紑鍚?*/
  simulationMode: boolean;
  /** 鏄惁鍚敤瑙勫垯 */
  enabled: boolean;
  /** 杩愯鐘舵€侊紝渚夸簬鍓嶇鍒ゆ柇绛栫暐鏄惁姝ｅ父鎵弿 */
  runtimeStatus: RuleRuntimeStatus;
  /** 鏈€杩戜竴娆¤繍琛岄敊璇紝绛栫暐鎴栬鎯呭紓甯告椂鍐欏叆 */
  lastErrorMessage?: string;
  /** 鏈€杩戜竴娆℃娴嬫椂闂?*/
  lastCheckedAt?: string;
  /** 鏈€杩戜竴娆¤Е鍙戞椂闂?*/
  lastTriggeredAt?: string;
  /** 鍒涘缓鏃堕棿 */
  createdAt: string;
  /** 鏇存柊鏃堕棿 */
  updatedAt: string;
}

export interface TriggerEvent {
  /** 瑙﹀彂浜嬩欢涓婚敭 */
  id: string;
  /** 鍏宠仈鐩戞帶瑙勫垯 ID */
  ruleId: string;
  /** 浜ゆ槗鎵€缂栫爜 */
  exchange: ExchangeCode;
  /** 缁熶竴浜ゆ槗瀵?*/
  symbol: string;
  /** 瑙﹀彂鏃跺競鍦轰环鏍?*/
  marketPrice: string;
  /** 瑙勫垯鐩爣浠锋牸 */
  targetPrice: string;
  /** 瑙﹀彂鐘舵€侊紝pending 琛ㄧず绛夊緟浜哄伐纭 */
  status: TriggerStatus;
  /** 瑙﹀彂鏃堕棿 */
  createdAt: string;
  /** 纭鏃堕棿 */
  confirmedAt?: string;
}

export interface TradingSignal {
  /** 淇″彿涓婚敭 */
  id: string;
  /** 鍏宠仈鐩戞帶瑙勫垯 ID */
  ruleId: string;
  /** 浜ゆ槗鎵€缂栫爜 */
  exchange: ExchangeCode;
  /** 缁熶竴浜ゆ槗瀵?*/
  symbol: string;
  /** 淇″彿鐢熸垚鏃跺競鍦轰环鏍?*/
  marketPrice: string;
  /** 琛屾儏浜嬩欢鏃堕棿锛岀敤浜庨鎺у垽鏂鎯呮槸鍚﹁繃鏈?*/
  marketEventTime: string;
  /** 淇″彿鏉ユ簮绫诲瀷锛宲rice_rule 琛ㄧず浠锋牸瑙勫垯鎵弿锛宔xternal_input 琛ㄧず澶栭儴杈撳叆 */
  sourceType: SignalSourceType;
  /** 瑙勫垯鐩爣浠锋牸 */
  targetPrice: string;
  /** 瑙﹀彂鏂瑰悜 */
  operator: TriggerOperator;
  /** 涓嬪崟鏂瑰悜 */
  side: OrderSide;
  /** 涓嬪崟绫诲瀷 */
  orderType: OrderType;
  /** 鍩虹甯佹暟閲?*/
  baseQuantity?: string;
  /** 璁′环甯侀噾棰?*/
  quoteAmount?: string;
  /** 闄愪环鍗曚环鏍?*/
  limitPrice?: string;
  /** 鏄惁妯℃嫙涓嬪崟 */
  simulationMode: boolean;
  /** 淇″彿鐘舵€?*/
  status: SignalStatus;
  /** 淇″彿鐢熸垚鍘熷洜 */
  reason: string;
  /** 澶栭儴淇″彿琛ュ厖涓婁笅鏂?JSON锛屼环鏍艰鍒欎俊鍙峰彲涓虹┖ */
  sourceMetadataJson?: string;
  /** 鍒涘缓鏃堕棿 */
  createdAt: string;
  /** 杞崲涓鸿Е鍙戜簨浠剁殑鏃堕棿 */
  convertedAt?: string;
}

export interface RiskCheck {
  /** 椋庢帶妫€鏌ヤ富閿?*/
  id: string;
  /** 鍏宠仈浜ゆ槗淇″彿 ID */
  signalId: string;
  /** 鍏宠仈鐩戞帶瑙勫垯 ID */
  ruleId: string;
  /** 浜ゆ槗鎵€缂栫爜 */
  exchange: ExchangeCode;
  /** 缁熶竴浜ゆ槗瀵?*/
  symbol: string;
  /** 椋庢帶缁撴灉 */
  status: RiskCheckStatus;
  /** 椋庢帶缁撹鎽樿 */
  reason: string;
  /** 淇″彿瀵瑰簲璁′环甯侀闄╂暈鍙?*/
  quoteExposure: string;
  /** 淇″彿甯傚満浠?*/
  marketPrice: string;
  /** 缁撴瀯鍖栭鎺ф槑缁?JSON 瀛楃涓?*/
  itemsJson: string;
  /** 鎸夋湇鍔＄鏈湴鏃ユ湡褰掓。鐨勭粺璁℃棩鏈燂紝鏍煎紡 YYYY-MM-DD */
  statDate: string;
  /** 鍒涘缓鏃堕棿 */
  createdAt: string;
}

export interface RiskConfig {
  /** 鍗曠瑪鏈€澶ц浠烽噾棰?*/
  maxQuoteAmount: string;
  /** 琛屾儏鏈€澶у厑璁稿欢杩燂紝鍗曚綅姣 */
  maxMarketAgeMs: number;
  /** 姣忔棩鏈€澶ч€氳繃椋庢帶娆℃暟 */
  dailyMaxTriggerCount: number;
  /** 姣忔棩鏈€澶ч€氳繃椋庢帶璁′环閲戦 */
  dailyMaxQuoteAmount: string;
  /** 浜ゆ槗妯″紡 */
  tradingMode: RiskTradingMode;
  /** 鏇存柊鏃堕棿 */
  updatedAt: string;
}

export interface DailyRiskStats {
  /** 缁熻鏃ユ湡锛屾牸寮?YYYY-MM-DD */
  statDate: string;
  /** 褰撴棩椋庢帶閫氳繃娆℃暟 */
  passedCount: number;
  /** 褰撴棩椋庢帶閫氳繃绱閲戦 */
  passedQuoteAmount: string;
  /** 褰撴棩椋庢帶鎷掔粷娆℃暟 */
  rejectedCount: number;
  /** 褰撴棩椋庢帶鎷掔粷绱閲戦 */
  rejectedQuoteAmount: string;
  /** 褰撴棩椋庢帶鎬绘鏁?*/
  totalCount: number;
  /** 褰撴棩椋庢帶绱鎬婚噾棰?*/
  totalQuoteAmount: string;
}

export interface DashboardSummary {
  /** 宸插惎鐢ㄧ洃鎺ц鍒欐暟閲?*/
  enabledRuleCount: number;
  /** 鐩戞帶瑙勫垯鎬绘暟 */
  ruleCount: number;
  /** 寰呬汉宸ョ‘璁ょ殑瑙﹀彂浜嬩欢鏁伴噺 */
  pendingTriggerCount: number;
  /** 璁㈠崟璁板綍鎬绘暟 */
  orderCount: number;
  /** 褰撳墠鍐呭瓨涓殑琛屾儏缂撳瓨鏁伴噺 */
  tickerCount: number;
}

export interface TradeAccount {
  /** 璐︽埛涓婚敭锛屾ā鎷熻处鎴蜂娇鐢ㄥ浐瀹?ID锛岀湡瀹炶处鎴峰悗缁彲浣跨敤浜ゆ槗鎵€璐︽埛 ID 鏄犲皠 */
  id: string;
  /** 璐︽埛绫诲瀷锛宻imulation 琛ㄧず鏈湴妯℃嫙璐︽埛锛宺eal 琛ㄧず鍚庣画鐪熷疄浜ゆ槗璐︽埛 */
  accountType: TradeAccountType;
  /** 璐︽埛鎵€灞炰氦鏄撴墍 */
  exchange: ExchangeCode;
  /** 璐︽埛榛樿璁′环甯佺锛屽綋鍓嶆ā鎷熶氦鏄撻粯璁や娇鐢?USDT */
  quoteCurrency: string;
  /** 鍒濆鏉冪泭锛岀敤浜庤绠楄处鎴锋€绘敹鐩婄巼 */
  initialEquity: string;
  /** 鍙敤璁′环甯佷綑棰?*/
  availableQuoteBalance: string;
  /** 鍐荤粨璁′环甯佷綑棰濓紝鍚庣画闄愪环鎸傚崟鏃朵娇鐢?*/
  lockedQuoteBalance: string;
  /** 鍒涘缓鏃堕棿 */
  createdAt: string;
  /** 鏇存柊鏃堕棿 */
  updatedAt: string;
}

export interface TradePosition {
  /** 鎸佷粨涓婚敭 */
  id: string;
  /** 鍏宠仈浜ゆ槗璐︽埛 ID */
  accountId: string;
  /** 璐︽埛绫诲瀷锛屼究浜庢湭鏉ョ粺涓€鏌ヨ妯℃嫙鍜岀湡瀹炴寔浠?*/
  accountType: TradeAccountType;
  /** 浜ゆ槗鎵€缂栫爜 */
  exchange: ExchangeCode;
  /** 缁熶竴浜ゆ槗瀵?*/
  symbol: string;
  /** 鍩虹甯佺锛屼緥濡?BTC */
  baseCurrency: string;
  /** 璁′环甯佺锛屼緥濡?USDT */
  quoteCurrency: string;
  /** 褰撳墠鎬绘寔浠撴暟閲?*/
  quantity: string;
  /** 褰撳墠鍙崠鍑烘暟閲?*/
  availableQuantity: string;
  /** 鍐荤粨鏁伴噺锛屽悗缁檺浠峰崠鍑烘寕鍗曟椂浣跨敤 */
  lockedQuantity: string;
  /** 骞冲潎鎸佷粨鎴愭湰浠?*/
  avgCostPrice: string;
  /** 褰撳墠鍓╀綑鎸佷粨鎴愭湰 */
  costAmount: string;
  /** 宸插疄鐜扮泩浜?*/
  realizedPnl: string;
  /** 绱鎵嬬画璐归噾棰?*/
  feeAmount: string;
  /** 鍒涘缓鏃堕棿 */
  createdAt: string;
  /** 鏇存柊鏃堕棿 */
  updatedAt: string;
}

export interface TradeFill {
  /** 鎴愪氦璁板綍涓婚敭 */
  id: string;
  /** 鍏宠仈浜ゆ槗璐︽埛 ID */
  accountId: string;
  /** 鍏宠仈璁㈠崟 ID锛屾ā鎷熸墜鍔ㄤ氦鏄撳悗缁篃浼氱敓鎴愯鍗曡褰?*/
  orderId?: string;
  /** 璐︽埛绫诲瀷 */
  accountType: TradeAccountType;
  /** 浜ゆ槗鎵€缂栫爜 */
  exchange: ExchangeCode;
  /** 缁熶竴浜ゆ槗瀵?*/
  symbol: string;
  /** 涔板叆鎴栧崠鍑烘柟鍚?*/
  side: OrderSide;
  /** 鎴愪氦浠锋牸 */
  price: string;
  /** 鎴愪氦鍩虹甯佹暟閲?*/
  baseQuantity: string;
  /** 鎴愪氦璁′环甯侀噾棰?*/
  quoteAmount: string;
  /** 鎵嬬画璐归噾棰?*/
  feeAmount: string;
  /** 鎵嬬画璐瑰竵绉?*/
  feeCurrency: string;
  /** 鏈鎴愪氦宸插疄鐜扮泩浜忥紝涔板叆閫氬父涓?0 */
  realizedPnl: string;
  /** 鍘熷鍝嶅簲鎴栨湰鍦版挳鍚堣鏄?*/
  rawMessage: string;
  /** 鎴愪氦鏃堕棿 */
  createdAt: string;
}

export interface TradeOperationLog {
  /** 鎿嶄綔鏃ュ織涓婚敭 */
  id: string;
  /** 鍏宠仈浜ゆ槗璐︽埛 ID */
  accountId: string;
  /** 璐︽埛绫诲瀷 */
  accountType: TradeAccountType;
  /** 浜ゆ槗鎵€缂栫爜 */
  exchange: ExchangeCode;
  /** 鏃ュ織绾у埆 */
  level: TradeOperationLogLevel;
  /** 鎿嶄綔鍔ㄤ綔锛屼緥濡?account.initialized銆乥uy.filled銆乻ell.rejected */
  action: string;
  /** 闈㈠悜鐢ㄦ埛鐨勬搷浣滄憳瑕?*/
  message: string;
  /** 缁撴瀯鍖栬鎯?JSON 瀛楃涓?*/
  payloadJson?: string;
  /** 鍒涘缓鏃堕棿 */
  createdAt: string;
}

export interface TradeOrderCheckItem {
  /** 妫€鏌ラ」缂栫爜 */
  code: string;
  /** 鏄惁閫氳繃 */
  passed: boolean;
  /** 妫€鏌ヨ鏄?*/
  message: string;
}

export interface TradeOrderPreview {
  /** 涓嬪崟妯″紡 */
  mode: TradeAccountType;
  /** 浜ゆ槗鎵€缂栫爜 */
  exchange: ExchangeCode;
  /** 缁熶竴浜ゆ槗瀵?*/
  symbol: string;
  /** 涓嬪崟鏂瑰悜 */
  side: OrderSide;
  /** 涓嬪崟绫诲瀷 */
  orderType: OrderType;
  /** 涓嬪崟鏁伴噺璇箟锛宐ase 琛ㄧず鎸夊熀纭€甯佹暟閲忎笅鍗曪紝quote 琛ㄧず鎸夎浠峰竵閲戦涓嬪崟 */
  quantityType: TradeOrderQuantityType;
  /** 鎵ц鍙傝€冧环 */
  executionPrice: string;
  /** 鍩虹甯佹暟閲?*/
  baseQuantity: string;
  /** 璁′环甯侀噾棰?*/
  quoteAmount: string;
  /** 鎵嬬画璐归噾棰?*/
  feeAmount: string;
  /** 鎵嬬画璐瑰竵绉?*/
  feeCurrency: string;
  /** 鍗栧嚭鏃堕璁″凡瀹炵幇鐩堜簭 */
  estimatedRealizedPnl: string;
  /** 鎴愪氦鍚庤浠峰竵鍙敤浣欓 */
  nextAvailableQuoteBalance: string;
  /** 鎴愪氦鍚庡熀纭€甯佸彲鐢ㄦ暟閲?*/
  nextAvailableBaseQuantity: string;
  /** 妫€鏌ラ」鏄惁鍏ㄩ儴閫氳繃 */
  passed: boolean;
  /** 妫€鏌ラ」鏄庣粏 */
  checkItems: TradeOrderCheckItem[];
  /** 棰勬鐢熸垚鐨勭‘璁や护鐗岋紝鐪熷疄涓嬪崟纭鏃跺繀椤诲洖浼?*/
  confirmToken?: string;
  /** 棰勮鐢熸垚鏃堕棿 */
  previewedAt: string;
}

export interface TradePositionView extends TradePosition {
  /** 鏈€鏂板競鍦轰环 */
  marketPrice: string;
  /** 鏈€鏂板競鍦轰环瀵瑰簲鐨勮鎯呮椂闂?*/
  marketEventTime?: string;
  /** 褰撳墠鎸佷粨甯傚€?*/
  marketValue: string;
  /** 娴姩鐩堜簭 */
  unrealizedPnl: string;
  /** 娴姩鏀剁泭鐜囩櫨鍒嗘瘮 */
  unrealizedPnlPercent: string;
}

export interface TradeAccountSummary {
  /** 璐︽埛涓婚敭 */
  accountId: string;
  /** 涓嬪崟妯″紡 */
  mode: TradeAccountType;
  /** 浜ゆ槗鎵€缂栫爜 */
  exchange: ExchangeCode;
  /** 璁′环甯佺 */
  quoteCurrency: string;
  /** 鍒濆鏉冪泭 */
  initialEquity: string;
  /** 鍙敤璁′环甯佷綑棰?*/
  availableQuoteBalance: string;
  /** 鍐荤粨璁′环甯佷綑棰?*/
  lockedQuoteBalance: string;
  /** 鎸佷粨甯傚€?*/
  positionMarketValue: string;
  /** 鎬绘潈鐩?*/
  totalEquity: string;
  /** 宸插疄鐜扮泩浜?*/
  realizedPnl: string;
  /** 娴姩鐩堜簭 */
  unrealizedPnl: string;
  /** 鎬绘敹鐩?*/
  totalPnl: string;
  /** 鎬绘敹鐩婄巼鐧惧垎姣?*/
  totalPnlPercent: string;
  /** 缁熻鏃堕棿 */
  calculatedAt: string;
}

export type TradeEquityHistorySource = 'snapshot' | 'carried' | 'initial';

export interface TradeEquitySnapshot {
  /** 蹇収涓婚敭 */
  id: string;
  /** 璐︽埛涓婚敭 */
  accountId: string;
  /** 涓嬪崟妯″紡 */
  mode: TradeAccountType;
  /** 浜ゆ槗鎵€缂栫爜 */
  exchange: ExchangeCode;
  /** 璁′环甯佺 */
  quoteCurrency: string;
  /** 蹇収鏃ユ湡锛屾牸寮?YYYY-MM-DD */
  snapshotDate: string;
  /** 褰撴棩鎬昏祫浜?*/
  totalEquity: string;
  /** 鍙敤璁′环甯佷綑棰?*/
  availableQuoteBalance: string;
  /** 鍐荤粨璁′环甯佷綑棰?*/
  lockedQuoteBalance: string;
  /** 鎸佷粨甯傚€?*/
  positionMarketValue: string;
  /** 宸插疄鐜扮泩浜?*/
  realizedPnl: string;
  /** 娴姩鐩堜簭 */
  unrealizedPnl: string;
  /** 鎬绘敹鐩?*/
  totalPnl: string;
  /** 鎬绘敹鐩婄巼鐧惧垎姣?*/
  totalPnlPercent: string;
  /** 鍒涘缓鏃堕棿 */
  createdAt: string;
  /** 鏇存柊鏃堕棿 */
  updatedAt: string;
}

export interface TradeEquityHistoryPoint {
  /** 璐︽埛涓婚敭 */
  accountId: string;
  /** 涓嬪崟妯″紡 */
  mode: TradeAccountType;
  /** 浜ゆ槗鎵€缂栫爜 */
  exchange: ExchangeCode;
  /** 璁′环甯佺 */
  quoteCurrency: string;
  /** 鏃ユ湡锛屾牸寮?YYYY-MM-DD */
  date: string;
  /** 鎬昏祫浜?*/
  totalEquity: string;
  /** 鏁版嵁鏉ユ簮锛宻napshot 涓虹湡瀹炴棩蹇収锛宑arried 涓哄墠涓€蹇収寤剁画锛宨nitial 涓哄垵濮嬫湰閲戣ˉ榻?*/
  source: TradeEquityHistorySource;
}

export interface OrderPreviewCheckItem {
  /** 妫€鏌ラ」缂栫爜锛屾柟渚垮墠绔ǔ瀹氬睍绀?*/
  code: string;
  /** 鏄惁閫氳繃 */
  passed: boolean;
  /** 妫€鏌ラ」璇存槑 */
  message: string;
}

export interface OrderPreview {
  /** 瑙﹀彂浜嬩欢 ID */
  triggerId: string;
  /** 鍏宠仈瑙勫垯 ID */
  ruleId: string;
  /** 浜ゆ槗鎵€缂栫爜 */
  exchange: ExchangeCode;
  /** 缁熶竴浜ゆ槗瀵?*/
  symbol: string;
  /** 涓嬪崟鏂瑰悜 */
  side: OrderSide;
  /** 涓嬪崟绫诲瀷 */
  orderType: OrderType;
  /** 瑙勫垯鐩爣浠锋牸 */
  targetPrice: string;
  /** 瑙﹀彂鏃跺競鍦轰环鏍?*/
  triggerPrice: string;
  /** 鎵ц鍙傝€冧环锛岄檺浠峰崟浼樺厛浣跨敤闄愪环浠锋牸锛屽競浠峰崟浣跨敤瑙﹀彂浠锋牸 */
  executionPrice: string;
  /** 鍩虹甯佹暟閲?*/
  baseQuantity?: string;
  /** 璁′环甯侀噾棰?*/
  quoteAmount?: string;
  /** 棰勪及鎴愪氦閲戦 */
  estimatedQuoteAmount: string;
  /** 鏈€澶ф粦鐐圭櫨鍒嗘瘮 */
  maxSlippagePercent: string;
  /** 鏄惁妯℃嫙浜ゆ槗 */
  simulationMode: boolean;
  /** 浜ゆ槗瑙勫垯妫€鏌ユ槸鍚﹂€氳繃 */
  tradingRulePassed: boolean;
  /** 浜ゆ槗瑙勫垯妫€鏌ユ槑缁?*/
  tradingRuleItems: OrderPreviewCheckItem[];
  /** 椋庢帶棰勮鏄惁閫氳繃 */
  riskPassed: boolean;
  /** 椋庢帶棰勮鏄庣粏 */
  riskItems: OrderPreviewCheckItem[];
  /** 浜ゆ槗璐︽埛妫€鏌ユ槸鍚﹂€氳繃 */
  accountPassed?: boolean;
  /** 浜ゆ槗璐︽埛妫€鏌ユ槑缁嗭紝鍖呮嫭浣欓銆佹寔浠撳拰鐪熷疄浜ゆ槗棰勬 */
  accountItems?: OrderPreviewCheckItem[];
  /** 鎴愪氦鍚庤浠峰竵鍙敤浣欓 */
  nextAvailableQuoteBalance?: string;
  /** 鎴愪氦鍚庡熀纭€甯佸彲鐢ㄦ暟閲?*/
  nextAvailableBaseQuantity?: string;
  /** 鍗栧嚭鏃堕璁″凡瀹炵幇鐩堜簭 */
  estimatedRealizedPnl?: string;
  /** 棰勮鐢熸垚鏃堕棿 */
  previewedAt: string;
}

export interface MarketHealthTicker {
  /** 浜ゆ槗鎵€缂栫爜 */
  exchange: ExchangeCode;
  /** 缁熶竴浜ゆ槗瀵?*/
  symbol: string;
  /** 鏈€鏂颁环鏍?*/
  price: string;
  /** 琛屾儏浜嬩欢鏃堕棿 */
  eventTime: string;
  /** 鏈湴缂撳瓨骞撮緞锛屽崟浣嶆绉?*/
  ageMs: number;
}

export interface PrivateTradeStreamHealth {
  /** 浜ゆ槗鎵€缂栫爜 */
  exchange: ExchangeCode;
  /** 鏄惁鍏峰鍚姩绉佹湁鎺ㄩ€佺殑鍩虹閰嶇疆 */
  enabled: boolean;
  /** 褰撳墠杩炴帴鐘舵€?*/
  status: 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error' | 'stopped';
  /** 鑷繘绋嬪惎鍔ㄤ互鏉ョ疮璁￠噸杩炴鏁?*/
  reconnectCount: number;
  /** 鏈€杩戜竴娆¤繛鎺ユ垚鍔熸椂闂?*/
  lastConnectedAt?: string;
  /** 鏈€杩戜竴娆℃柇寮€鏃堕棿 */
  lastDisconnectedAt?: string;
  /** 鏈€杩戜竴娆＄姸鎬佸彉鍖栨椂闂?*/
  lastStatusChangedAt?: string;
  /** 鏈€杩戜竴娆￠敊璇椂闂?*/
  lastErrorAt?: string;
  /** 鏈€杩戜竴娆￠敊璇憳瑕?*/
  lastErrorMessage?: string;
  /** 鏈€杩戜竴娆¤鍗曟帹閫佹椂闂?*/
  lastOrderUpdateAt?: string;
  /** 鏈€杩戜竴娆′綑棰濇帹閫佹椂闂?*/
  lastBalanceUpdateAt?: string;
}

export interface MarketHealth {
  /** 浜ゆ槗鎵€缂栫爜 */
  exchange: ExchangeCode;
  /** 浜ゆ槗鐜鏍囩锛屼緥濡?OKX 妯℃嫙鐩樸€丱KX 瀹炵洏銆丅inance 娴嬭瘯缃戙€丅inance 涓荤綉 */
  tradingEnvironment: string;
  /** REST 鏄惁澶勪簬閫€閬夸腑 */
  restBackoffActive: boolean;
  /** REST 閫€閬跨粨鏉熸椂闂?*/
  restBackoffUntil?: string;
  /** 鏈€杩戜竴娆?REST 閿欒 */
  lastRestError?: string;
  /** 鏈€杩戜竴娆℃€昏鍒锋柊鏃堕棿 */
  overviewRefreshedAt?: string;
  /** 褰撳墠 WebSocket 璁㈤槄浜ゆ槗瀵?*/
  subscribedSymbols: string[];
  /** 褰撳墠缂撳瓨琛屾儏 */
  tickers: MarketHealthTicker[];
  /** 鐪熷疄浜ゆ槗绉佹湁鎺ㄩ€佸仴搴风姸鎬?*/
  privateTradeStream: PrivateTradeStreamHealth;
}

export interface RuleExecutionDetail {
  /** 鐩戞帶瑙勫垯璇︽儏 */
  rule: MonitorRule;
  /** 璇ヨ鍒欏叧鑱旂殑浜ゆ槗淇″彿 */
  signals: TradingSignal[];
  /** 璇ヨ鍒欏叧鑱旂殑椋庢帶妫€鏌?*/
  riskChecks: RiskCheck[];
  /** 璇ヨ鍒欏叧鑱旂殑瑙﹀彂璁板綍 */
  triggers: TriggerEvent[];
  /** 璇ヨ鍒欏叧鑱旂殑璁㈠崟璁板綍 */
  orders: OrderRecord[];
  /** 璇ヨ鍒欏叧鑱旂殑瀹¤鏃ュ織 */
  auditLogs: AuditLog[];
  /** 瑙勫垯鎵€灞炰氦鏄撴墍鐨勮鎯呭仴搴风姸鎬?*/
  marketHealth: MarketHealth;
}

export interface OrderRecord {
  /** 璁㈠崟璁板綍涓婚敭 */
  id: string;
  /** 鍏宠仈瑙﹀彂浜嬩欢 ID锛屾墜鍔ㄥ揩鎹蜂氦鏄撳彲涓虹┖ */
  triggerId?: string;
  /** 鍏宠仈瑙勫垯 ID锛屾墜鍔ㄥ揩鎹蜂氦鏄撳彲涓虹┖ */
  ruleId?: string;
  /** 浜ゆ槗鎵€缂栫爜 */
  exchange: ExchangeCode;
  /** 缁熶竴浜ゆ槗瀵?*/
  symbol: string;
  /** 涔板叆鎴栧崠鍑烘柟鍚?*/
  side: OrderSide;
  /** 涓嬪崟绫诲瀷 */
  orderType: OrderType;
  /** 鍩虹甯佹暟閲?*/
  baseQuantity?: string;
  /** 璁′环甯侀噾棰?*/
  quoteAmount?: string;
  /** 濮旀墭浠锋牸 */
  price?: string;
  /** 浜ゆ槗鎵€璁㈠崟鍙凤紝妯℃嫙涓嬪崟鏃朵负鏈湴鐢熸垚 */
  exchangeOrderId: string;
  /** 缁熶竴璁㈠崟鐘舵€?*/
  status: UnifiedOrderStatus;
  /** 鏄惁妯℃嫙璁㈠崟 */
  simulationMode: boolean;
  /** 浜ゆ槗鎵€鍝嶅簲鎽樿鎴栭敊璇鏄?*/
  rawMessage: string;
  /** 鍒涘缓鏃堕棿 */
  createdAt: string;
}

export interface OrderRecoveryRecord {
  /** 鎭㈠璁板綍涓婚敭 */
  id: string;
  /** 鎭㈠鍘婚噸閿紝鍚屼竴闂鍦ㄦ湭鎭㈠鍓嶅鐢ㄥ悓涓€鏉¤褰?*/
  identityKey: string;
  /** 鍏宠仈鏈湴璁㈠崟 ID锛屼氦鏄撴墍绾у紓甯稿彲涓虹┖ */
  orderId?: string;
  /** 鍏宠仈浜ゆ槗鎵€璁㈠崟鍙凤紝渚夸簬鎺掓煡鐪熷疄浜ゆ槗闂 */
  exchangeOrderId?: string;
  /** 浜ゆ槗鎵€缂栫爜 */
  exchange: ExchangeCode;
  /** 澶辫触鏉ユ簮锛宮anual 琛ㄧず蹇嵎浜ゆ槗锛宺ule 琛ㄧず绛栫暐璁″垝锛宻ystem 琛ㄧず绯荤粺绾ф仮澶嶄换鍔?*/
  source: OrderRecoverySource;
  /** 涓嬪崟妯″紡锛屽綋鍓嶆仮澶嶄富鎵撶湡瀹炰氦鏄撻摼璺?*/
  mode: TradeAccountType;
  /** 缁熶竴浜ゆ槗瀵癸紝浜ゆ槗鎵€绾у紓甯稿彲涓虹┖ */
  symbol?: string;
  /** 澶辫触闃舵 */
  failureStage: OrderRecoveryFailureStage;
  /** 褰撳墠鎭㈠鐘舵€?*/
  recoveryStatus: OrderRecoveryStatus;
  /** 宸插皾璇曟仮澶嶆鏁?*/
  retryCount: number;
  /** 鑷姩鎭㈠鏈€澶у皾璇曟鏁?*/
  maxRetryCount: number;
  /** 鏈€杩戜竴娆￠敊璇爜 */
  lastErrorCode?: string;
  /** 鏈€杩戜竴娆￠敊璇秷鎭?*/
  lastErrorMessage?: string;
  /** 涓嬫鍏佽鑷姩鎭㈠鐨勬椂闂达紝浜哄伐澶嶈瘯涓嶅彈璇ュ瓧娈甸檺鍒?*/
  nextRetryAt?: string;
  /** 缁撴瀯鍖栦笂涓嬫枃 JSON */
  payloadJson?: string;
  /** 鍒涘缓鏃堕棿 */
  createdAt: string;
  /** 鏇存柊鏃堕棿 */
  updatedAt: string;
  /** 鎭㈠瀹屾垚鏃堕棿 */
  resolvedAt?: string;
}

export interface AuditLog {
  /** 瀹¤鏃ュ織涓婚敭 */
  id: string;
  /** 鏃ュ織绾у埆锛屽尯鍒嗘櫘閫氳褰曘€佽鍛婂拰閿欒 */
  level: AuditLogLevel;
  /** 鎿嶄綔鍔ㄤ綔锛屼娇鐢ㄥ浐瀹氭灇涓炬柟渚垮墠绔瓫閫?*/
  action: AuditLogAction;
  /** 鍏宠仈瀹炰綋绫诲瀷锛屼緥濡?trigger銆乷rder銆乻trategy */
  entityType: string;
  /** 鍏宠仈瀹炰綋 ID锛屽彲涓虹┖ */
  entityId?: string;
  /** 鍏宠仈瑙勫垯 ID锛屽彲涓虹┖ */
  ruleId?: string;
  /** 鍏宠仈瑙﹀彂浜嬩欢 ID锛屽彲涓虹┖ */
  triggerId?: string;
  /** 鍏宠仈璁㈠崟 ID锛屽彲涓虹┖ */
  orderId?: string;
  /** 闈㈠悜鐢ㄦ埛鍜屾帓鏌ヤ汉鍛樼殑鎽樿淇℃伅 */
  message: string;
  /** 缁撴瀯鍖栬鎯?JSON 瀛楃涓诧紝淇濈暀鍏抽敭涓婁笅鏂?*/
  payloadJson?: string;
  /** 鍒涘缓鏃堕棿 */
  createdAt: string;
}

export interface TradeDailyReport {
  /** 褰掓。鏃ユ湡锛屾牸寮?YYYY-MM-DD */
  date: string;
  /** 褰撴棩璁㈠崟鎬绘暟锛屽凡鎸?mode 鍜?exchange 鑱氬悎 */
  orderCount: number;
  /** 褰撴棩宸叉垚浜よ鍗曟暟锛宻tatus = 'filled' */
  filledOrderCount: number;
  /** 褰撴棩澶辫触鎴栨嫆缁濊鍗曟暟锛宻tatus IN ('rejected', 'failed') */
  failedOrderCount: number;
  /** 褰撴棩宸插彇娑堣鍗曟暟锛宻tatus = 'cancelled' */
  cancelledOrderCount: number;
  /** 褰撴棩绱鎴愪氦棰濓紝鏉ヨ嚜 trade_fills.quote_amount */
  totalQuoteAmount: string;
  /** 褰撴棩绱鎵嬬画璐癸紝鏉ヨ嚜 trade_fills.fee_amount */
  totalFeeAmount: string;
  /** 褰撴棩绱宸插疄鐜扮泩浜忥紝鏉ヨ嚜 trade_fills.realized_pnl */
  totalRealizedPnl: string;
  /** 褰撴棩涔板叆鎴愪氦绗旀暟锛宼rade_fills.side = 'buy' */
  buyCount: number;
  /** 褰撴棩鍗栧嚭鎴愪氦绗旀暟锛宼rade_fills.side = 'sell' */
  sellCount: number;
  /** 褰撴棩绛栫暐淇″彿鏁帮紝鏉ヨ嚜 trading_signals.created_at */
  signalCount: number;
  /** 褰撴棩椋庢帶閫氳繃娆℃暟锛宺isk_checks.status = 'passed' 涓?stat_date 鍖归厤 */
  riskPassCount: number;
  /** 褰撴棩椋庢帶鎷掔粷娆℃暟锛宺isk_checks.status = 'rejected' 涓?stat_date 鍖归厤 */
  riskRejectCount: number;
}
