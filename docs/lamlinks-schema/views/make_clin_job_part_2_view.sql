-- dbo.make_clin_job_part_2_view



/* view make_clin_job_part_2_view: add view */


/* view make_clin_job_part_2_view: add view */


/* view make_clin_job_part_2_view: add view */

/* view make_clin_job_part_2_view: add view */


/* view make_clin_job_part_2_view: add view */
CREATE VIEW dbo.make_clin_job_part_2_view
AS
SELECT DISTINCT 
                         make_clin_job_part_1_view_1_result.cntrct_k79, make_clin_job_part_1_view_1_result.rel_no_k80, make_clin_job_part_1_view_1_result.clinno_k81, make_clin_job_part_1_view_1_result.prjnam_k73, 
                         make_clin_job_part_1_view_1_result.m_code_mke, make_clin_job_part_1_view_1_result.prtnum_mke, make_clin_job_part_1_view_1_result.pn_rev_mke, make_clin_job_part_1_view_1_result.p_desc_mke, 
                         make_clin_job_part_1_view_1_result.fsc_mke, make_clin_job_part_1_view_1_result.niin_mke, make_clin_job_part_1_view_1_result.prtnum_mrq, make_clin_job_part_1_view_1_result.pn_rev_mrq, 
                         make_clin_job_part_1_view_1_result.m_code_mrq, make_clin_job_part_1_view_1_result.p_desc_mrq, make_clin_job_part_1_view_1_result.fsc_mrq, make_clin_job_part_1_view_1_result.niin_mrq, 
                         make_clin_job_part_1_view_1_result.p_um_mrq, make_clin_job_part_1_view_1_result.idnk79_k79, make_clin_job_part_1_view_1_result.idnk81_k81, make_clin_job_part_1_view_1_result.idnk73_k73, 
                         make_clin_job_part_1_view_1_result.idnk08_mke, make_clin_job_part_1_view_1_result.idnk71_mke, make_clin_job_part_1_view_1_result.idnka9_ka9, make_clin_job_part_1_view_1_result.idnk08_mrq, 
                         make_clin_job_part_1_view_1_result.idnk71_mrq, make_clin_job_part_1_view_1_result.idnka8_ka8, make_clin_job_part_1_view_1_result.job_no_ka8, make_clin_job_part_1_view_1_result.jln_no_ka9, 
                         make_clin_job_part_1_view_1_result.jlndte_ka9, make_clin_job_part_1_view_1_result.jlnqty_ka9, make_clin_job_part_1_view_1_result.jlnsta_ka9, make_clin_job_part_1_view_1_result.jlnsdt_ka9, 
                         make_clin_job_part_1_view_1_result.prtnum_mrq AS prtnum_k71, make_clin_job_part_1_view_1_result.pn_rev_mrq AS pn_rev_k71, make_clin_job_part_1_view_1_result.m_code_mrq AS e_code_mfg, 
                         make_clin_job_part_1_view_1_result.p_desc_mrq AS p_desc_k71, make_clin_job_part_1_view_1_result.idnk08_mrq AS idnk08_k08, make_clin_job_part_1_view_1_result.idnk71_mrq AS idnk71_k71, 
                         make_clin_job_part_1_view_1_query.idnk71_mrq AS idnk71_cmp, make_clin_job_part_1_view_1_result.fsc_mrq AS fsc_k08, make_clin_job_part_1_view_1_result.niin_mrq AS niin_k08, dbo.make_job_2_view.bv_num_kd2, 
                         dbo.make_job_2_view.bvstat_kd2, make_clin_job_part_1_view_1_result.reqdly_k81, dbo.make_job_2_view.idnkab_kab, dbo.make_job_2_view.rnq_11_kab, dbo.make_job_2_view.rlq_11_kab, 
                         dbo.make_job_2_view.snq_15_kab, dbo.make_job_2_view.slq_15_kab, dbo.make_job_2_view.mkq_11_kab, make_clin_job_part_1_view_1_result.idnkab_kab AS idnkab_mrq, 
                         make_clin_job_part_1_view_1_result.rnq_11_kab AS rnq_11_mrq, make_clin_job_part_1_view_1_result.mkq_11_kab AS mkq_11_mrq, make_clin_job_part_1_view_1_result.rlq_11_kab AS rlq_11_mrq, 
                         make_clin_job_part_1_view_1_result.snq_15_kab AS snq_15_mrq, make_clin_job_part_1_view_1_result.slq_15_kab AS slq_15_mrq, make_clin_job_part_1_view_1_result.piidno_k80
FROM            dbo.make_clin_job_part_1_view AS make_clin_job_part_1_view_1_result INNER JOIN
                         dbo.make_clin_job_part_1_view AS make_clin_job_part_1_view_1_query ON make_clin_job_part_1_view_1_result.idnk81_k81 = make_clin_job_part_1_view_1_query.idnk81_k81 INNER JOIN
                         dbo.make_job_2_view ON make_clin_job_part_1_view_1_result.idnka9_ka9 = dbo.make_job_2_view.idnka9_ka9





