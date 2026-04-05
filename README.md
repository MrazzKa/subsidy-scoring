# SubsidyScore AI

**Merit-based scoring system for agricultural subsidies in Kazakhstan**

Hackathon: **Decentrathon 5.0** | Track: **AI inDrive** | Case 2: Скоринг сельхозпроизводителей при получении субсидий

---

## Проблема

Сельскохозяйственные субсидии в Казахстане распределяются через ГИСС (subsidy.plem.kz) по принципу **FIFO** — кто первый подал заявку, тот первый получил. Этот подход не учитывает качество, обоснованность заявок и соответствие нормативно-правовым актам.

## Решение

5-компонентный **Merit Score** с интеграцией НПА Республики Казахстан:

```
MERIT = 0.25 × Efficiency + 0.15 × Reliability + 0.15 × Need + 0.15 × Regulatory + 0.30 × ML
```

| Компонент | Вес | Что оценивает |
|-----------|-----|---------------|
| **Efficiency** | 0.25 | Адекватность запроса нормативам категории (log-отклонение от медианы) |
| **Reliability** | 0.15 | Паттерны подачи: рабочие часы (+15), рабочий день (+10), ранняя подача (+15) |
| **Need** | 0.15 | Потребность региона: меньше субсидий → выше (+30), совпадение специализации (+20) |
| **Regulatory** | 0.15 | Соответствие НПА РК: приоритет направления, диапазон нормативов, пастбищная ёмкость |
| **ML Score** | 0.30 | Ансамбль GradientBoosting (0.5) + RandomForest (0.3) + LogisticRegression (0.2) |

## Нормативная база (НПА РК)

Система интегрирует 3 нормативно-правовых акта:

| НПА | Документ | Применение |
|-----|----------|------------|
| [V1500011064](https://adilet.zan.kz/rus/docs/V1500011064) | Нормы нагрузки на площадь пастбищ | ML-feature `pasture_capacity` + Regulatory Score для скотоводческих направлений |
| [V1900018404](https://adilet.zan.kz/rus/docs/V1900018404) | Правила субсидирования племенного животноводства | ML-features `is_priority_direction`, `normative_in_npa_range` + Regulatory Score |
| [V1500012488](https://adilet.zan.kz/rus/docs/V1500012488) | Правила субсидирования растениеводства | Нормативы возмещения затрат (50-70%) |

НПА используется на двух уровнях:
- **A) ML-features**: модель _обучается_ на нормативном контексте (3 дополнительных фичи)
- **B) Composite scoring**: Regulatory Score — отдельный компонент Merit Score

## 26 ML-Features (6 групп)

| Группа | Кол-во | Признаки |
|--------|--------|----------|
| Финансовые | 7 | log_amount, log_normative, log_estimated_units, amount_vs_regional_median, amount_vs_category_median, is_large_request, normative_amount_ratio |
| Временные | 9 | month, quarter, day_of_week, day_of_month, hour, is_working_hours, is_weekday, submission_speed, is_early_submission |
| Региональные | 3 | region_application_count, district_application_count, month_application_count |
| НПА-based | 3 | is_priority_direction, normative_in_npa_range, pasture_capacity |
| Кодированные | 4 | region_enc, direction_enc, subsidy_category_enc, district_enc |

**Защита от data leakage**: Approval rate фичи вычисляются через LOO-Bayesian encoding, но сознательно исключены из FEATURE_COLS — используются только в MeritScorer.

## Метрики

### Cross-Validation (5-fold Stratified CV)

| Модель | AUC | Accuracy | F1 | Вес |
|--------|-----|----------|-----|-----|
| GradientBoosting | ~0.75 | ~0.87 | ~0.93 | 0.5 |
| RandomForest | ~0.72 | ~0.86 | ~0.93 | 0.3 |
| LogisticRegression | ~0.62 | ~0.86 | ~0.93 | 0.2 |

### Temporal Validation (80/20 по дате)
Модель обучена на первых 80% заявок по дате, протестирована на последних 20% — проверка обобщения во времени.

## Функциональность

### Dashboard (9 вкладок)
1. **Обзор** — ключевые метрики, распределение скоров, риски, статистика по направлениям
2. **Регионы** — сравнение регионов, % рекомендованных
3. **Модель** — CV метрики, Temporal Validation, Feature Importance, Fairness Audit, методология
4. **Рейтинг** — фильтры, поиск, детали заявок, explain, improvement tips, экспорт Excel
5. **FIFO vs Merit** — сравнение подходов, бюджетный симулятор
6. **Нормативная база** — 3 НПА, таблицы направлений и пастбищных зон
7. **Оценить заявку** — скоринг новой заявки через обученную ML-модель
8. **AI-ассистент** — чат с LLM (Groq/Llama 3.3) с контекстом данных
9. **Загрузить данные** — upload файла, preview, auto-маппинг колонок, запуск pipeline

### Дополнительно
- **Anomaly Detection** — IsolationForest для выявления аномальных заявок
- **Fairness Audit** — CV между регионами, диапазон % рекомендованных
- **Budget Simulation** — сравнение FIFO vs Merit при заданном бюджете
- **Export** — выгрузка рейтинга в Excel/CSV с фильтрами
- **Improvement Tips** — рекомендации заявителю по улучшению Merit Score

## API

| Endpoint | Method | Описание |
|----------|--------|----------|
| `/` | GET | Health check |
| `/api/stats` | GET | Полные данные dashboard |
| `/api/ranking` | GET | Рейтинг с фильтрами (region, direction, min/max_score, risk_level, search, anomaly_only) |
| `/api/explain/{id}` | GET | Объяснение скора: 5 компонентов + regulatory + improvement tips |
| `/api/score` | POST | Скоринг одной заявки через обученную ML-модель |
| `/api/budget-simulation` | GET | Симуляция распределения бюджета FIFO vs Merit |
| `/api/regulatory/info` | GET | Информация об НПА |
| `/api/export/ranking` | GET | Экспорт рейтинга (xlsx/csv) |
| `/api/upload/preview` | POST | Предпросмотр загруженного файла |
| `/api/upload` | POST | Загрузка данных + запуск pipeline |
| `/api/pipeline/status` | GET | Статус pipeline |
| `/api/chat` | POST | AI-ассистент |
| `/api/model/info` | GET | Информация о моделях |
| `/api/features` | GET | Feature importance |

## Быстрый старт

```bash
# Установка зависимостей
pip install -r requirements.txt

# Запуск полного pipeline (обучение + скоринг + сохранение)
python src/pipeline.py

# Запуск API
python src/api.py
# → http://localhost:8000

# Dashboard (dev)
cd dashboard-runner && npm install && npm run dev
# → http://localhost:5173

# Тесты
pytest tests/ -v
```

## Docker

```bash
# С docker-compose
docker-compose up --build
# → http://localhost:8000

# Или напрямую
docker build -t subsidy-scoring .
docker run -p 8000:8000 subsidy-scoring
```

Для AI-ассистента установите `GROQ_API_KEY`:
```bash
export GROQ_API_KEY=your_key_here
```

## Структура проекта

```
subsidy-scoring/
├── data/                        # Выгрузка ГИСС (xlsx, не коммитится)
├── src/
│   ├── preprocessing.py         # Загрузка, очистка, 26 features
│   ├── model.py                 # ML модели, temporal validation, anomaly detection
│   ├── scoring.py               # 5-компонентный Merit Scorer
│   ├── regulatory.py            # НПА РК: 3 акта, ML-features, Regulatory Score
│   ├── column_mapper.py         # Smart Column Mapper для загрузки данных
│   ├── pipeline.py              # Главный pipeline
│   └── api.py                   # FastAPI сервер (14 эндпоинтов)
├── dashboard-runner/
│   └── src/App.jsx              # React дашборд (9 вкладок)
├── outputs/                     # Результаты pipeline
│   ├── ranking.csv              # Рейтинг заявок
│   ├── dashboard_data.json      # Данные для дашборда
│   ├── model_results.json       # CV-метрики моделей
│   ├── feature_importance.csv   # Важность признаков
│   └── trained_model.joblib     # Обученная модель
├── tests/
│   └── test_pipeline.py         # 14 тестов
├── Dockerfile
├── docker-compose.yml
├── fly.toml
├── requirements.txt
└── README.md
```

## Ограничения

- Данные обезличены — нет признаков идентичности заявителя (ИИН/БИН)
- Только данные 2025 года — при изменении политики субсидирования модель нужно переобучить
- Нет внешних источников (погода, спутниковые снимки, рыночные цены, размер хозяйства)
- AUC ~0.75 — модель работает лучше случайного, но не идеально (что ожидаемо при обезличенных данных)
- AI-ассистент требует внешний API-ключ (Groq)

## Human-in-the-Loop

Система **рекомендует**, но не **решает**. Рейтинг и объяснения служат инструментом поддержки принятия решений для комиссии. Финальное решение по каждой заявке остаётся за человеком.
