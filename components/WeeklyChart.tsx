import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@/lib/useTheme';
import { useAppStore, DailyStat } from '@/lib/store';
import { colors, spacing, typography } from '@/constants/theme';

const BAR_GAP = 8;
const CHART_HEIGHT = 100;

export type ChartPeriod = 'daily' | 'weekly' | 'monthly';

function getDateRange(period: ChartPeriod): string[] {
  const days: string[] = [];
  const now = new Date();
  const count = period === 'daily' ? 7 : period === 'weekly' ? 4 : 6;
  if (period === 'daily') {
    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().split('T')[0]);
    }
  } else if (period === 'weekly') {
    const sunday = new Date(now);
    sunday.setDate(sunday.getDate() - sunday.getDay());
    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(sunday);
      d.setDate(d.getDate() - i * 7);
      days.push(d.toISOString().split('T')[0]);
    }
  } else {
    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setMonth(d.getMonth() - i);
      days.push(d.toISOString().split('T')[0].slice(0, 7));
    }
  }
  return days;
}

function getDayLabel(dateStr: string, lang: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const dayIndex = d.getDay();
  const labels: Record<string, string[]> = {
    tr: ['Pz', 'Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct'],
    en: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'],
    de: ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'],
    fr: ['Di', 'Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa'],
    es: ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'],
    pt: ['Do', 'Se', 'Te', 'Qu', 'Qi', 'Se', 'Sá'],
    ru: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
    ar: ['أح', 'إث', 'ثل', 'أر', 'خم', 'جم', 'سب'],
    ja: ['日', '月', '火', '水', '木', '金', '土'],
    ko: ['일', '월', '화', '수', '목', '금', '토'],
  };
  return (labels[lang] ?? labels.en)[dayIndex];
}

function getWeekLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

function getMonthLabel(yearMonth: string, lang: string): string {
  const monthIndex = parseInt(yearMonth.split('-')[1], 10) - 1;
  const labels: Record<string, string[]> = {
    tr: ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'],
    en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    de: ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'],
    fr: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'],
    es: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
    pt: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
    ru: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'],
    ar: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
    ja: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
    ko: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'],
  };
  return (labels[lang] ?? labels.en)[monthIndex];
}

interface Props {
  period?: ChartPeriod;
}

export default function WeeklyChart({ period = 'daily' }: Props) {
  const { colors: t, accent } = useTheme();
  const { t: tr } = useTranslation();
  const dailyStats = useAppStore(s => s.dailyStats);
  const language = useAppStore(s => s.language);

  const dateRange = useMemo(() => getDateRange(period), [period]);

  const statsMap = useMemo(() => {
    const map: Record<string, { swipes: number; quizCorrect: number }> = {};
    for (const s of dailyStats) {
      if (period === 'monthly') {
        const key = s.date.slice(0, 7);
        if (!map[key]) map[key] = { swipes: 0, quizCorrect: 0 };
        map[key].swipes += s.swipes;
        map[key].quizCorrect += s.quizCorrect;
      } else if (period === 'weekly') {
        const d = new Date(s.date + 'T12:00:00');
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - d.getDay());
        const key = weekStart.toISOString().split('T')[0];
        if (!map[key]) map[key] = { swipes: 0, quizCorrect: 0 };
        map[key].swipes += s.swipes;
        map[key].quizCorrect += s.quizCorrect;
      } else {
        map[s.date] = { swipes: s.swipes, quizCorrect: s.quizCorrect };
      }
    }
    return map;
  }, [dailyStats, period]);

  const chartData = useMemo(() => {
    return dateRange.map(date => {
      const stat = statsMap[date];
      return {
        date,
        swipes: stat?.swipes ?? 0,
        quizCorrect: stat?.quizCorrect ?? 0,
      };
    });
  }, [dateRange, statsMap]);

  const barWidth = period === 'monthly' ? 32 : period === 'weekly' ? 36 : 24;
  const maxVal = Math.max(1, ...chartData.map(d => d.swipes + d.quizCorrect));
  const chartWidth = chartData.length * (barWidth + BAR_GAP) - BAR_GAP;

  function getLabel(dateStr: string): string {
    if (period === 'monthly') return getMonthLabel(dateStr, language);
    if (period === 'weekly') return getWeekLabel(dateStr);
    return getDayLabel(dateStr, language);
  }

  return (
    <View style={styles.container}>
      <View style={styles.chartRow}>
        <Svg width={chartWidth} height={CHART_HEIGHT}>
          {chartData.map((d, i) => {
            const total = d.swipes + d.quizCorrect;
            const barH = (total / maxVal) * (CHART_HEIGHT - 4);
            const quizH = (d.quizCorrect / maxVal) * (CHART_HEIGHT - 4);
            const x = i * (barWidth + BAR_GAP);
            return (
              <React.Fragment key={d.date}>
                <Rect
                  x={x}
                  y={CHART_HEIGHT - barH}
                  width={barWidth}
                  height={Math.max(barH, 2)}
                  rx={4}
                  fill={accent + '30'}
                />
                {d.quizCorrect > 0 && (
                  <Rect
                    x={x}
                    y={CHART_HEIGHT - quizH}
                    width={barWidth}
                    height={Math.max(quizH, 2)}
                    rx={4}
                    fill={accent}
                  />
                )}
              </React.Fragment>
            );
          })}
        </Svg>
      </View>
      <View style={styles.labels}>
        {chartData.map((d) => (
          <Text
            key={d.date}
            style={[styles.dayLabel, { color: t.textTertiary, width: barWidth + BAR_GAP }]}
          >
            {getLabel(d.date)}
          </Text>
        ))}
      </View>
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: accent + '30' }]} />
          <Text style={[typography.footnote, { color: t.textTertiary }]}>{tr('home.chart_swipes')}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: accent }]} />
          <Text style={[typography.footnote, { color: t.textTertiary }]}>{tr('home.chart_quiz')}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: spacing.md,
  },
  chartRow: {
    alignItems: 'center',
  },
  labels: {
    flexDirection: 'row',
  },
  dayLabel: {
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
  },
  legend: {
    flexDirection: 'row',
    gap: spacing.xl,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
