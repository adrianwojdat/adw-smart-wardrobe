/** Only the latest request for the currently selected criteria may publish a result. */
export class RecommendationRequest {
  private revision = 0;
  private criteria = '';
  observe(criteria: string) {
    if (criteria !== this.criteria) {
      this.criteria = criteria;
      this.revision++;
    }
  }
  begin() {
    return ++this.revision;
  }
  accepts(revision: number, submitted: string, current: string) {
    return revision === this.revision && submitted === current;
  }
}
