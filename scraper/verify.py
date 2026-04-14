def confirm(summary: str) -> bool:
    print(f"\n{'='*50}")
    print(summary)
    print('='*50)
    answer = input("Continue? [y/n]: ").strip().lower()
    return answer == "y"
