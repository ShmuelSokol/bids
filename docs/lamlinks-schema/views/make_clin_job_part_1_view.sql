-- dbo.make_clin_job_part_1_view



/* view make_clin_job_part_1_view: add view */


/* view make_clin_job_part_1_view: add view */


/* view make_clin_job_part_1_view: add view */

/* view make_clin_job_part_1_view: add view */


/* view make_clin_job_part_1_view: add view */


/* view make_clin_job_part_1_view: add view */


/* view make_clin_job_part_1_view: add view */


/* view make_clin_job_part_1_view: add view */


/* view make_clin_job_part_1_view: add view */


/* view make_clin_job_part_1_view: add view */
/* view make_clin_job_part_1_view: add view 
 view make_clin_job_part_1_view: add view 
 view make_clin_job_part_1_view: add view 
 view make_clin_job_part_1_view: add view 
 view make_clin_job_part_1_view: add view 
 view make_clin_job_part_1_view: add view 
 view make_clin_job_part_1_view: add view 
 view make_clin_job_part_1_view: add view */
CREATE VIEW [dbo].[make_clin_job_part_1_view]
AS
SELECT        dbo.make_clin_1_view.cntrct_k79, dbo.make_clin_1_view.rel_no_k80, dbo.make_clin_1_view.clinno_k81, dbo.make_clin_1_view.prjnam_k73, dbo.make_clin_1_view.e_code_mfg AS m_code_mke, 
                         dbo.make_clin_1_view.prtnum_k71 AS prtnum_mke, dbo.make_clin_1_view.pn_rev_k71 AS pn_rev_mke, dbo.make_clin_1_view.p_desc_k71 AS p_desc_mke, dbo.make_clin_1_view.fsc_k08 AS fsc_mke, 
                         dbo.make_clin_1_view.niin_k08 AS niin_mke, dbo.clin_job_part_2_view.prtnum_k71 AS prtnum_mrq, dbo.clin_job_part_2_view.pn_rev_k71 AS pn_rev_mrq, 
                         dbo.clin_job_part_2_view.e_code_mfg AS m_code_mrq, dbo.clin_job_part_2_view.p_desc_k71 AS p_desc_mrq, dbo.clin_job_part_2_view.fsc_k08 AS fsc_mrq, dbo.clin_job_part_2_view.niin_k08 AS niin_mrq, 
                         dbo.clin_job_part_2_view.p_um_k71 AS p_um_mrq, dbo.make_clin_1_view.idnk79_k79, dbo.make_clin_1_view.idnk81_k81, dbo.make_clin_1_view.idnk73_k73, dbo.make_clin_1_view.idnk08_k08 AS idnk08_mke,
                          dbo.make_clin_1_view.idnk71_k71 AS idnk71_mke, dbo.clin_job_part_2_view.idnka9_ka9, dbo.clin_job_part_2_view.idnkab_kab, dbo.clin_job_part_2_view.idnk08_k08 AS idnk08_mrq, 
                         dbo.clin_job_part_2_view.idnk71_k71 AS idnk71_mrq, dbo.clin_job_part_2_view.rnq_11_kab, dbo.clin_job_part_2_view.rlq_11_kab, dbo.clin_job_part_2_view.snq_15_kab, dbo.clin_job_part_2_view.slq_15_kab, 
                         dbo.clin_job_part_2_view.mkq_11_kab, dbo.clin_job_part_2_view.idnka8_ka8, dbo.clin_job_part_2_view.job_no_ka8, dbo.clin_job_part_2_view.jln_no_ka9, dbo.clin_job_part_2_view.jlndte_ka9, 
                         dbo.clin_job_part_2_view.jlnqty_ka9, dbo.clin_job_part_2_view.jlnsta_ka9, dbo.clin_job_part_2_view.jlnsdt_ka9, dbo.make_clin_1_view.reqdly_k81, dbo.clin_job_part_2_view.jrqpur_ka9, 
                         dbo.clin_job_part_2_view.idnk85_k85, dbo.clin_job_part_2_view.sop_um_k84, dbo.clin_job_part_2_view.dlydte_k85, dbo.make_clin_1_view.piidno_k80
FROM            dbo.make_clin_1_view INNER JOIN
                         dbo.clin_job_part_2_view ON dbo.make_clin_1_view.idnk81_k81 = dbo.clin_job_part_2_view.idnk81_k81 AND dbo.clin_job_part_2_view.jrqpur_ka9 = 'Make'










