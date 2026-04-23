-- dbo.supplier_rma_demographics_1_view



/* view supplier_rma_demographics_1_view: add view */


/* view supplier_rma_demographics_1_view: add view */


/* view supplier_rma_demographics_1_view: add view */

/* view supplier_rma_demographics_1_view: add view */


/* view supplier_rma_demographics_1_view: add view */


/* view supplier_rma_demographics_1_view: add view */


/* view supplier_rma_demographics_1_view: add view */


/* view supplier_rma_demographics_1_view: add view */


/* view supplier_rma_demographics_1_view: add view */


/* view supplier_rma_demographics_1_view: add view */


/* view supplier_rma_demographics_1_view: add view */


/* view supplier_rma_demographics_1_view: add view */


/* view supplier_rma_demographics_1_view: add view */


/* view supplier_rma_demographics_1_view: add view */


/* view supplier_rma_demographics_1_view: add view */


/* view supplier_rma_demographics_1_view: add view */


/* view supplier_rma_demographics_1_view: add view */


/* view supplier_rma_demographics_1_view: add view */
CREATE VIEW [dbo].[supplier_rma_demographics_1_view]
AS
SELECT     dbo.supplier_rma_1_view.s_code_k39, dbo.supplier_rma_1_view.e_name_k12, dbo.supplier_rma_1_view.idnk39_k39, dbo.supplier_rma_1_view.sradte_kct, 
                      dbo.supplier_rma_1_view.sranum_kct, dbo.supplier_rma_1_view.sraino_kct, dbo.supplier_rma_1_view.idnkct_kct, dbo.demographic_relationship_1_view.idnka7_ka7, 
                      dbo.demographic_relationship_1_view.uptime_ka7, dbo.demographic_relationship_1_view.idnk12_ka7, dbo.demographic_relationship_1_view.gduset_ka7, 
                      dbo.demographic_relationship_1_view.frozen_ka7, dbo.demographic_relationship_1_view.d_code_ka7, dbo.demographic_relationship_1_view.d_name_ka7, 
                      dbo.demographic_relationship_1_view.d_nam2_ka7, dbo.demographic_relationship_1_view.d_nam3_ka7, dbo.demographic_relationship_1_view.d_adr1_ka7, 
                      dbo.demographic_relationship_1_view.d_adr2_ka7, dbo.demographic_relationship_1_view.d_adr3_ka7, dbo.demographic_relationship_1_view.d_adr4_ka7, 
                      dbo.demographic_relationship_1_view.d_city_ka7, dbo.demographic_relationship_1_view.d_stte_ka7, dbo.demographic_relationship_1_view.d_zipc_ka7, 
                      dbo.demographic_relationship_1_view.d_cntr_ka7, dbo.demographic_relationship_1_view.d_attn_ka7, dbo.demographic_relationship_1_view.d_phon_ka7, 
                      dbo.demographic_relationship_1_view.d_faxn_ka7, dbo.demographic_relationship_1_view.d_emal_ka7, dbo.demographic_relationship_1_view.gdutbl_ka6, 
                      dbo.demographic_relationship_1_view.idngdu_ka6, dbo.demographic_relationship_1_view.frozen_ka6, dbo.demographic_relationship_1_view.idnka6_ka6
FROM         dbo.supplier_rma_1_view INNER JOIN
                      dbo.demographic_relationship_1_view ON dbo.supplier_rma_1_view.idnkct_kct = dbo.demographic_relationship_1_view.idngdu_ka6
WHERE     (dbo.demographic_relationship_1_view.gdutbl_ka6 = 'kct')


















