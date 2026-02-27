export type CertLink = { id: string; hours_applied: number };

export type ActivityBody = {
  id?: string; // frontend-generated UUID so file paths match the DB record
  title: string;
  provider: string;
  activity_date: string;
  total_hours: string | number;
  category?: string;
  description?: string;
  attachment_urls?: string[];
  certifications: CertLink[];
};

export function validateActivity(body: ActivityBody): Record<string, string> {
  const errors: Record<string, string> = {};

  const title = (body.title ?? "").trim();
  if (!title) errors.title = "Activity title is required.";
  else if (title.length > 200) errors.title = "Title must be 200 characters or fewer.";

  const provider = (body.provider ?? "").trim();
  if (!provider) errors.provider = "Provider is required.";
  else if (provider.length > 200) errors.provider = "Provider must be 200 characters or fewer.";

  if (!body.activity_date) {
    errors.activity_date = "Date is required.";
  } else {
    const d = new Date(body.activity_date + "T00:00:00Z");
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    if (isNaN(d.getTime())) errors.activity_date = "Enter a valid date.";
    else if (d > today) errors.activity_date = "Date cannot be in the future.";
  }

  const hours = Number(body.total_hours);
  if (!body.total_hours && body.total_hours !== 0) {
    errors.total_hours = "Total hours is required.";
  } else if (isNaN(hours) || hours <= 0) {
    errors.total_hours = "Hours must be greater than 0.";
  } else if (hours > 500) {
    errors.total_hours = "Hours cannot exceed 500.";
  }

  if (!body.certifications?.length) {
    errors.certifications = "At least one certification must be selected.";
  } else {
    for (const c of body.certifications) {
      const h = Number(c.hours_applied);
      if (isNaN(h) || h <= 0) {
        errors.certifications = "Hours applied must be greater than 0 for each certification.";
        break;
      }
    }
  }

  return errors;
}
