-- dbo.a_make_job_3_view



/* view a_make_job_3_view: add view */


/* view a_make_job_3_view: add view */


/* view a_make_job_3_view: add view */

/* view a_make_job_3_view: add view */


/* view a_make_job_3_view: add view */
CREATE VIEW [dbo].[a_make_job_3_view]
AS
SELECT     dbo.make_job_1_view.*, dbo.make_clin_job_part_1_view.idnk71_mrq, dbo.make_clin_job_part_1_view.rnq_11_kab, dbo.make_clin_job_part_1_view.rlq_11_kab, 
                      dbo.make_clin_job_part_1_view.snq_15_kab, dbo.make_clin_job_part_1_view.slq_15_kab, dbo.make_clin_job_part_1_view.mkq_11_kab
FROM         dbo.make_job_1_view INNER JOIN
                      dbo.make_clin_job_part_1_view ON dbo.make_job_1_view.idnka9_ka9 = dbo.make_clin_job_part_1_view.idnka9_ka9





