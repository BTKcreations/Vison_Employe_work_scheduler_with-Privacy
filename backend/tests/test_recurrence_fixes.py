from datetime import datetime
from app.models.recurring_task import RecurrenceType

# Mock the RecurrenceRule class to avoid Beanie Initialization issues
class MockRecurrenceRule:
    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)

# Monkeypatch calculation logic locally
from app.services.recurrence_service import calculate_next_run

def test_daily_recurrence():
    rule = MockRecurrenceRule(
        type=RecurrenceType.DAILY,
        interval=2,
        next_run=datetime(2024, 1, 1, 10, 0)
    )
    next_run = calculate_next_run(rule)
    assert next_run == datetime(2024, 1, 3, 10, 0)

def test_weekly_recurrence():
    rule = MockRecurrenceRule(
        type=RecurrenceType.WEEKLY,
        interval=1,
        weekdays=[0, 2, 4], # Mon, Wed, Fri
        next_run=datetime(2024, 1, 1, 10, 0) # 2024-01-01 is Monday (0)
    )
    next_run = calculate_next_run(rule)
    assert next_run == datetime(2024, 1, 3, 10, 0) # Wed

def test_monthly_31st():
    rule = MockRecurrenceRule(
        type=RecurrenceType.MONTHLY,
        interval=1,
        month_day=31,
        next_run=datetime(2024, 1, 31, 10, 0)
    )
    next_run = calculate_next_run(rule)
    assert next_run == datetime(2024, 2, 29, 10, 0) # Leap year Feb

    rule.next_run = next_run
    next_run2 = calculate_next_run(rule)
    assert next_run2 == datetime(2024, 3, 31, 10, 0)

def test_yearly_recurrence():
    rule = MockRecurrenceRule(
        type=RecurrenceType.YEARLY,
        interval=1,
        next_run=datetime(2024, 2, 29, 10, 0)
    )
    next_run = calculate_next_run(rule)
    assert next_run == datetime(2025, 2, 28, 10, 0) # Leap year fallback

if __name__ == "__main__":
    test_daily_recurrence()
    test_weekly_recurrence()
    test_monthly_31st()
    test_yearly_recurrence()
    print("All tests passed!")
