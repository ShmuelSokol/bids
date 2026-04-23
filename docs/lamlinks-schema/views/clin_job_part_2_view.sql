-- dbo.clin_job_part_2_view



/* view clin_job_part_2_view: add view */


/* view clin_job_part_2_view: add view */


/* view clin_job_part_2_view: add view */

/* view clin_job_part_2_view: add view */


/* view clin_job_part_2_view: add view */


/* view clin_job_part_2_view: add view */


/* view clin_job_part_2_view: add view */


/* view clin_job_part_2_view: add view */


/* view clin_job_part_2_view: add view */


/* view clin_job_part_2_view: add view */


/* view clin_job_part_2_view: add view */


/* view clin_job_part_2_view: add view */


/* view clin_job_part_2_view: add view */


/* view clin_job_part_2_view: add view */


/* view clin_job_part_2_view: add view */


/* view clin_job_part_2_view: add view */


/* view clin_job_part_2_view: add view */


/* view clin_job_part_2_view: add view */
CREATE VIEW [dbo].[clin_job_part_2_view]
AS
SELECT     part_material_requirements.fsc_k08, part_material_requirements.niin_k08, part_material_requirements.prtnum_k71, part_material_requirements.p_desc_k71, 
                      part_material_requirements.pn_rev_k71, part_material_requirements.e_code_mfg, part_material_requirements.p_um_k71, dbo.clin_job_part_1_view.cnq_11_kab, 
                      dbo.clin_job_part_1_view.mkq_11_kab, dbo.clin_job_part_1_view.rnq_11_kab, dbo.clin_job_part_1_view.rlq_11_kab, dbo.clin_job_part_1_view.rcq_11_kab, 
                      dbo.clin_job_part_1_view.rrq_11_kab, dbo.clin_job_part_1_view.roq_11_kab, dbo.clin_job_part_1_view.snq_15_kab, dbo.clin_job_part_1_view.slq_15_kab, 
                      dbo.clin_job_part_1_view.srq_15_kab, dbo.clin_job_part_1_view.soq_15_kab, part_material_requirements.idnk08_k08, dbo.clin_job_part_1_view.idnk71_k71, 
                      dbo.clin_job_part_1_view.idnk81_k81, dbo.clin_job_part_1_view.idnka9_ka9, dbo.clin_job_part_1_view.idnkab_kab, dbo.clin_job_part_1_view.idnka8_ka8, 
                      dbo.clin_job_part_1_view.job_no_ka8, dbo.clin_job_part_1_view.jln_no_ka9, dbo.clin_job_part_1_view.jlndte_ka9, dbo.clin_job_part_1_view.jlnqty_ka9, 
                      dbo.clin_job_part_1_view.jlnsta_ka9, dbo.clin_job_part_1_view.jlnsdt_ka9, dbo.clin_job_part_1_view.jrqpur_ka9, dbo.clin_job_part_1_view.idnk85_k85, 
                      dbo.clin_job_part_1_view.sop_um_k84, dbo.clin_job_part_1_view.dlydte_k85
FROM         dbo.clin_job_part_1_view INNER JOIN
                      dbo.part_2_view AS part_material_requirements ON dbo.clin_job_part_1_view.idnk71_k71 = part_material_requirements.idnk71_k71


















