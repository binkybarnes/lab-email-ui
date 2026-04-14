import asyncio
import argparse
from stages import stage1_faculty, stage2_urls, stage3_crawl, stage4_extract, stage5_merge

STAGES = {
    "stage1": stage1_faculty.run,
    "stage2": stage2_urls.run,
    "stage3": stage3_crawl.run,
    "stage4": stage4_extract.run,
    "stage5": stage5_merge.run,
}


async def run_all() -> None:
    for name, fn in STAGES.items():
        print(f"\n{'#'*50}")
        print(f"# {name.upper()}")
        print(f"{'#'*50}")
        await fn()


def main() -> None:
    parser = argparse.ArgumentParser(description="UCSD Lab scraper pipeline")
    parser.add_argument(
        "stage",
        choices=list(STAGES.keys()) + ["all"],
        help="Which stage to run, or 'all' to run everything",
    )
    args = parser.parse_args()

    if args.stage == "all":
        asyncio.run(run_all())
    else:
        asyncio.run(STAGES[args.stage]())


if __name__ == "__main__":
    main()
